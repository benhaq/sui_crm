module company::salary_vault {
    use sui::tx_context::{ epoch_timestamp_ms};
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::table::{Self, Table};
    use company::payment_token::PAYMENT_TOKEN;
    use company::errors;
    use company::events::{ emit_salary_claimed, emit_salary_vault_created, emit_funds_withdrawn};

    /// Struct to hold entitlement information
    public struct Entitlement has copy, drop, store {
        recipient: address,
        amount: u64,
    }

    /// Represents a salary vault for a specific month and year
    public struct SalaryVault has key {
        id: UID,
        month: u64,
        year: u64,
        owner: address,
        balance: Balance<PAYMENT_TOKEN>,
        entitlements: Table<address, u64>,
    }

    /// Creates a new salary vault with employee entitlements and deposited funds
    public fun create_salary_vault(
        month: u64,
        year: u64,
        entitlements_vec: vector<Entitlement>,
        coin_in: Coin<PAYMENT_TOKEN>,
        ctx: &mut TxContext,
    ) {
        let mut total = 0;
        let mut i = 0;
        while (i < vector::length(&entitlements_vec)) {
            let item: &Entitlement = vector::borrow(&entitlements_vec, i);
            total = total + item.amount;
            i = i + 1;
        };
        let initial_deposit_value = coin::value(&coin_in);
        assert!(initial_deposit_value == total, errors::invalid_amount());

        let mut vault = SalaryVault {
            id: object::new(ctx),
            month,
            year,
            owner: tx_context::sender(ctx),
            balance: coin::into_balance(coin_in),
            entitlements: table::new(ctx),
        };

        let mut j = 0;
        while (j < vector::length(&entitlements_vec)) {
            let item: &Entitlement = vector::borrow(&entitlements_vec, j);
            table::add(&mut vault.entitlements, item.recipient, item.amount);
            j = j + 1;
        };

        emit_salary_vault_created(object::id(&vault), vault.month, vault.year, vault.owner, initial_deposit_value, epoch_timestamp_ms(ctx));


        transfer::share_object(vault);
    }

    /// Checks if an employee is eligible to claim salary from this vault.
    /// Returns true if the employee is in the entitlements table and their claimable amount is > 0.
    public fun is_eligible_to_claim(vault: &SalaryVault, employee_address: address): bool {
        if (table::contains(&vault.entitlements, employee_address)) {
            let amount = *table::borrow(&vault.entitlements, employee_address);
            amount > 0
        } else {
            false
        }
    }

    /// Allows an employee to claim their salary for the month
    public entry fun claim_salary(vault: &mut SalaryVault, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        assert!(is_eligible_to_claim(vault, sender), errors::employee_not_eligible());
        let amount = *table::borrow(&vault.entitlements, sender);
        let payment = balance::split(&mut vault.balance, amount);
        let coin_payment = coin::from_balance(payment, ctx);
        transfer::public_transfer(coin_payment, sender);
        *table::borrow_mut(&mut vault.entitlements, sender) = 0;

        emit_salary_claimed(object::id(vault), sender, amount, vault.month, vault.year, epoch_timestamp_ms(ctx));
    }

    /// Allows the boss to withdraw remaining funds
    public entry fun withdraw_remaining(vault: &mut SalaryVault, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        assert!(sender == vault.owner, errors::no_access());
        let remaining_value = balance::value(&vault.balance);
        if (remaining_value > 0) {
            let payment = balance::split(&mut vault.balance, remaining_value);
            let coin_payment = coin::from_balance(payment, ctx);
            transfer::public_transfer(coin_payment, sender);

            emit_funds_withdrawn(object::id(vault), sender, remaining_value, epoch_timestamp_ms(ctx));

        }
    }
}