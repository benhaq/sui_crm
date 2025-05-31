module company::employee_log {
    use sui::clock::{Self as clock, Clock};
    use company::whitelist::{Self, Whitelist};
    use company::errors;
    use company::events::{emit_employee_check_in, emit_employee_check_out};


    public entry fun check_in(
        wl: &Whitelist,
        c: &Clock,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        assert!(whitelist::is_member(wl, sender), errors::not_whitelisted_for_daily_access());

        let check_in_timestamp = clock::timestamp_ms(c);
        emit_employee_check_in(sender, check_in_timestamp);
    }


    public entry fun check_out(
        employee_address: address,
        original_check_in_time: u64,
        c: &Clock,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        assert!(employee_address == sender, errors::no_access());

        let check_out_timestamp = clock::timestamp_ms(c);
        assert!(check_out_timestamp > original_check_in_time, errors::invalid_log());
        let duration_ms = check_out_timestamp - original_check_in_time;
        emit_employee_check_out(sender, original_check_in_time, check_out_timestamp, duration_ms);

    }

    // calculate_duration can remain a helper if used by check_out_and_emit or off-chain
    public fun calculate_duration_from_times(check_in: u64, check_out: u64): u64 {
        assert!(check_out > check_in, errors::invalid_log());
        check_out - check_in
    }

}