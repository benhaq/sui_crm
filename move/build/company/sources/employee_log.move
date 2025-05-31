
module company::employee_log {
    use sui::clock::{Clock};
    use company::whitelist::{Self, Whitelist};
    use company::key_request::{Self, KeyRequest};
    use company::errors;

    public struct EmployeeLog has key {
        id: UID,
        employee: address,
        check_in_time: u64,
        check_out_time: u64,
        duration: u64,
    }

    public struct WITNESS has drop {}

    public fun request_check_in(
        wl: &Whitelist,
        c: &Clock,
        ctx: &mut TxContext,
    ): KeyRequest {
        let sender = tx_context::sender(ctx);
        assert!(wl.is_whitelisted(sender), errors::no_access());
        whitelist::request_access(wl, c, ctx)
    }

    public fun request_check_out(
        wl: &Whitelist,
        c: &Clock,
        ctx: &mut TxContext,
    ): KeyRequest {
        let sender = tx_context::sender(ctx);
        assert!(wl.is_whitelisted(sender), errors::no_access());
        whitelist::request_access(wl, c, ctx)
    }

    public fun check_in(
        req: &KeyRequest,
        wl: &Whitelist,
        c: &Clock,
        ctx: &mut TxContext,
    ): EmployeeLog {
        assert!(key_request::verify(req, WITNESS {}, whitelist::namespace(wl), tx_context::sender(ctx), c), errors::no_access());
        EmployeeLog {
            id: object::new(ctx),
            employee: tx_context::sender(ctx),
            check_in_time: c.timestamp_ms(),
            check_out_time: 0,
            duration: 0,
        }
    }

    public fun check_out(
        log: &mut EmployeeLog,
        req: &KeyRequest,
        wl: &Whitelist,
        c: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(key_request::verify(req, WITNESS {}, whitelist::namespace(wl), tx_context::sender(ctx), c), errors::no_access());
        assert!(log.employee == tx_context::sender(ctx), errors::no_access());
        log.check_out_time = c.timestamp_ms();
        log.duration = calculate_duration(log);
    }

    public fun destroy(log: EmployeeLog) {
        let EmployeeLog { id, employee: _, check_in_time: _, check_out_time: _, duration: _ } = log;
        object::delete(id);
    }

    public fun calculate_duration(log: &EmployeeLog): u64 {
        assert!(log.check_out_time > log.check_in_time, errors::invalid_log());
        log.check_out_time - log.check_in_time
    }

    public fun get_employee_log(log: &EmployeeLog): address {
        log.employee
    }

    #[test_only]
    public fun destroy_for_testing(log: EmployeeLog) {
        let EmployeeLog { id, employee: _, check_in_time: _, check_out_time: _, duration: _ } = log;
        object::delete(id);
    }

    #[test]
    fun test_employee_workflow() {

        let ctx = &mut tx_context::dummy();
        let mut c = clock::create_for_testing(ctx);

        let wl = whitelist::create_whitelist(vector[@0x0], ctx);

        clock::increment_for_testing(&mut c, 32_400_000);
        let kr_in = request_check_in(&wl, &c, ctx);

        let mut log = check_in(&kr_in, &wl,  &c, ctx);

        clock::increment_for_testing(&mut c, 28_800_000);

        let kr_out = request_check_out(&wl, &c, ctx);

        check_out(&mut log, &kr_out, &wl, &c, ctx);

        let duration = calculate_duration(&log);
        assert!(duration == 28_800_000, errors::invalid_amount());


        destroy_for_testing(log);
        whitelist::destroy_for_testing(wl);
        clock::destroy_for_testing(c);
        key_request::destroy_for_testing(kr_in);
        key_request::destroy_for_testing(kr_out);
    }
}