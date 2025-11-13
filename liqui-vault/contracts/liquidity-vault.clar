;; Liquidity Vault - Commitment-based liquidity with yield distribution
;; Unique angle: simple time-locked tranches with programmable penalty that feeds a shared pool,
;; plus per-share yield accrual. Deposits mint "shares" 1:1 with STX for predictable UX.

(define-constant ERR_UNAUTHORIZED (err u100))
(define-constant ERR_AMOUNT_ZERO (err u101))
(define-constant ERR_INSUFFICIENT (err u102))

(define-data-var admin principal tx-sender)
(define-data-var penalty-bps uint u500)              ;; 5% early withdrawal penalty
(define-data-var min-lock-blocks uint u100)          ;; minimum lock duration in blocks (~ a few minutes on devnet)

(define-data-var total-shares uint u0)
(define-data-var yps uint u0)                        ;; yield-per-share scaled by SCALE
(define-constant SCALE u1000000)

(define-map user-shares { who: principal } { shares: uint })
(define-map user-locks { who: principal } { until: uint })
(define-map user-yps-paid { who: principal } { paid: uint })
(define-map user-yield-owed { who: principal } { amt: uint })

(define-read-only (get-admin) (ok (var-get admin)))
(define-read-only (get-penalty-bps) (ok (var-get penalty-bps)))
(define-read-only (get-min-lock-blocks) (ok (var-get min-lock-blocks)))
(define-read-only (get-total-shares) (ok (var-get total-shares)))
(define-read-only (get-yps) (ok (var-get yps)))

(define-read-only (get-user (who principal))
  (let
    (
      (s (default-to { shares: u0 } (map-get? user-shares { who: who })))
      (l (default-to { until: u0 } (map-get? user-locks { who: who })))
      (p (default-to { paid: u0 } (map-get? user-yps-paid { who: who })))
      (o (default-to { amt: u0 } (map-get? user-yield-owed { who: who })))
    )
    (ok { shares: (get shares s), locked-until: (get until l), paid: (get paid p), owed: (get amt o) })
  )
)

(define-private (is-admin (who principal))
  (is-eq who (var-get admin))
)

(define-public (set-penalty-bps (bps uint))
  (begin
    (if (not (is-admin tx-sender)) ERR_UNAUTHORIZED
      (begin (var-set penalty-bps bps) (ok bps))
    )
  )
)

(define-public (set-min-lock-blocks (blocks uint))
  (begin
    (if (not (is-admin tx-sender)) ERR_UNAUTHORIZED
      (begin (var-set min-lock-blocks blocks) (ok blocks))
    )
  )
)

(define-private (settle-yield (who principal))
  (let
    (
      (s (default-to { shares: u0 } (map-get? user-shares { who: who })))
      (paid-old (get paid (default-to { paid: u0 } (map-get? user-yps-paid { who: who }))))
      (owed-old (get amt (default-to { amt: u0 } (map-get? user-yield-owed { who: who }))))
      (yps-now (var-get yps))
    )
    (let
      (
        (delta (if (> yps-now paid-old) (- yps-now paid-old) u0))
        (accrual (/ (* (get shares s) delta) SCALE))
        (new-owed (+ owed-old accrual))
      )
      (begin
        (map-set user-yps-paid { who: who } { paid: yps-now })
        (map-set user-yield-owed { who: who } { amt: new-owed })
        (ok new-owed)
      )
    )
  )
)

(define-public (deposit (amount uint) (lock-blocks uint))
  (begin
    (if (<= amount u0) ERR_AMOUNT_ZERO
      (if (< lock-blocks (var-get min-lock-blocks)) (err u103)
(let
          (
            (contract-principal (as-contract tx-sender))
            (transfer (stx-transfer? amount tx-sender contract-principal))
          )
(match transfer
            ok-bool
              (begin
                (unwrap-panic (settle-yield tx-sender))
                (let
                  (
                    (prev (default-to { shares: u0 } (map-get? user-shares { who: tx-sender })))
                    (new-shares (+ (get shares prev) amount))
                    (prev-lock (get until (default-to { until: u0 } (map-get? user-locks { who: tx-sender }))))
                    (candidate (+ block-height lock-blocks))
                    (new-lock (if (> prev-lock candidate) prev-lock candidate))
                  )
                  (begin
                    (map-set user-shares { who: tx-sender } { shares: new-shares })
                    (map-set user-locks { who: tx-sender } { until: new-lock })
                    (var-set total-shares (+ (var-get total-shares) amount))
                    (ok new-shares)
                  )
                )
              )
            err-code (err err-code)
          )
        )
      )
    )
  )
)

(define-public (withdraw (amount uint))
  (let
    (
      (s (default-to { shares: u0 } (map-get? user-shares { who: tx-sender })))
    )
    (if (or (<= amount u0) (> amount (get shares s))) ERR_INSUFFICIENT
      (begin
        (unwrap-panic (settle-yield tx-sender))
        (let
          (
            (locked-until (get until (default-to { until: u0 } (map-get? user-locks { who: tx-sender }))))
            (pen-bps (var-get penalty-bps))
            (penalty (if (< block-height locked-until) (/ (* amount pen-bps) u10000) u0))
            (payout (- amount penalty))
            (new-shares (- (get shares s) amount))
          )
          (begin
            (map-set user-shares { who: tx-sender } { shares: new-shares })
            (if (is-eq new-shares u0) (map-delete user-locks { who: tx-sender }) true)
            (var-set total-shares (- (var-get total-shares) amount))
(let ((user tx-sender)) (asserts! (is-ok (as-contract (stx-transfer? payout tx-sender user))) (err u104)))
            (ok { paid: payout, penalty: penalty })
          )
        )
      )
    )
  )
)

(define-public (distribute-yield (amount uint))
  (begin
    (if (not (is-admin tx-sender)) ERR_UNAUTHORIZED
      (if (<= amount u0) ERR_AMOUNT_ZERO
        (if (<= (var-get total-shares) u0) (err u105)
(let
            (
              (contract-principal (as-contract tx-sender))
              (transfer (stx-transfer? amount tx-sender contract-principal))
            )
(match transfer
              ok-bool
                (let ((inc (/ (* amount SCALE) (var-get total-shares))))
                  (begin (var-set yps (+ (var-get yps) inc)) (ok (var-get yps)))
                )
              err-code (err err-code)
            )
          )
        )
      )
    )
  )
)

(define-public (claim-yield)
  (begin
    (unwrap-panic (settle-yield tx-sender))
    (let ((owed (get amt (default-to { amt: u0 } (map-get? user-yield-owed { who: tx-sender })))) )
      (if (<= owed u0) (ok u0)
        (begin
(map-set user-yield-owed { who: tx-sender } { amt: u0 })
          (let ((user tx-sender)) (asserts! (is-ok (as-contract (stx-transfer? owed tx-sender user))) (err u106)))
          (ok owed)
        )
      )
    )
  )
)