module company::worklog {
    use company::employee_log::{Self, EmployeeLog};

    #[test_only]
    use company::whitelist;
    #[test_only]
    use company::key_request;
    #[test_only]
    use sui::clock;
    #[test_only]
    use company::errors;

    public struct WorklogData {
        employee: address,
        date: vector<u8>,
        duration: u64,
    }

    public fun prepare_worklog_data(log: &EmployeeLog, date: vector<u8>): WorklogData {
        WorklogData {
            employee: employee_log::get_employee_log(log),
            date,
            duration: employee_log::calculate_duration(log),
        }
    }
    #[test_only]
    public fun destroy_for_testing(log: WorklogData) {
        let WorklogData { employee: _, date: _, duration: _ } = log;
    }

    #[test]
    fun test_employee_workflow() {

        let ctx = &mut tx_context::dummy();
        let mut c = clock::create_for_testing(ctx);

        let wl = whitelist::create_whitelist(vector[@0x0], ctx);

        clock::increment_for_testing(&mut c, 32_400_000);
        let kr_in = employee_log::request_check_in(&wl, &c, ctx);

        let mut log = employee_log::check_in(&kr_in, &wl,  &c, ctx);

        clock::increment_for_testing(&mut c, 28_800_000);

        let kr_out = employee_log::request_check_out(&wl, &c, ctx);

        employee_log::check_out(&mut log, &kr_out, &wl, &c, ctx);

        let duration = employee_log::calculate_duration(&log);
        assert!(duration == 28_800_000, errors::invalid_amount());

        let date_bytes = b"2023-10-01";
        let _worklog_data = prepare_worklog_data(&log, date_bytes);

        employee_log::destroy_for_testing(log);
        whitelist::destroy_for_testing(wl);
        clock::destroy_for_testing(c);
        destroy_for_testing(_worklog_data);
        key_request::destroy_for_testing(kr_in);
        key_request::destroy_for_testing(kr_out);
    }
}