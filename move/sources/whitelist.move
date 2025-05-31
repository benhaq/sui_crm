module company::whitelist {
    use sui::vec_set::{Self, VecSet};
    use std::string::String;
    use sui::clock::Clock;
    use company::key_request::{Self, KeyRequest};
    use company::errors;
    use company::events::{emit_whitelist_created};

    const TTL: u64 = 86_399_000; // ~24 hours in milliseconds (1 day)
    
    public struct WITNESS has drop {}

    public struct Whitelist has key {
        id: UID,
        name: String,
        users: VecSet<address>,
    }

    public struct WhitelistCap has key {
        id: UID,
        whitelist_id: ID,
    }

    public fun create_whitelist(name: String, users: vector<address>, ctx: &mut TxContext): WhitelistCap {
        let mut users_set = vec_set::empty<address>();
        let mut i = 0;
        let initial_count = users.length();
        while (i < initial_count) {
            vec_set::insert(&mut users_set, *vector::borrow(&users, i));
            i = i + 1;
        };
        let wl = Whitelist {
            id: object::new(ctx),
            name,
            users: users_set,
        };
        let wl_id = object::id(&wl);

        emit_whitelist_created(wl_id, initial_count);
        transfer::share_object(wl);
        let cap = WhitelistCap {
            id: object::new(ctx),
            whitelist_id: wl_id,
        };
        cap

    }
    entry fun create_allowlist_entry(name: String, users: vector<address>, ctx: &mut TxContext) {
        transfer::transfer(create_whitelist(name, users, ctx), ctx.sender());
    }

    public fun namespace(whitelist: &Whitelist): vector<u8> {
        whitelist.id.to_bytes()
    }

    public fun is_whitelisted(wl: &Whitelist, user: address): bool {
        wl.users.contains(&user)
    }
    
    public fun add_user( wl: &mut Whitelist,  cap: &WhitelistCap, user: address, _ctx: &mut TxContext) {
        assert!(cap.whitelist_id == object::id(wl), errors::invalid_cap());
        assert!(!wl.users.contains(&user), errors::duplicate());
        vec_set::insert(&mut wl.users, user);
    }
    public fun remove_user(wl: &mut Whitelist, cap: &WhitelistCap, user: address, _ctx: &mut TxContext) {
        assert!(cap.whitelist_id == object::id(wl), errors::invalid_cap());
        assert!(wl.users.contains(&user), errors::no_access());
        vec_set::remove(&mut wl.users, &user);
    }
    /// Users request access using request_access.
    public fun request_access(wl: &Whitelist, c: &Clock, ctx: &mut TxContext): KeyRequest {
        assert!(wl.users.contains(&tx_context::sender(ctx)), errors::no_access());
        key_request::request_key(WITNESS {}, namespace(wl), tx_context::sender(ctx), c, TTL, ctx)
    }

    /// Seal only checks consistency of the request using req.verify.
    /// The actual policy is checked in request_access above.
    entry fun seal_approve(id: vector<u8>, req: &KeyRequest, c: &Clock, ctx: &TxContext) {
        assert!(req.verify(WITNESS {}, id, tx_context::sender(ctx), c), errors::no_access());
    }

    #[test_only]
    public fun destroy_for_testing(wl: Whitelist) {
        let Whitelist { id, users: _, name: _ } = wl;
        object::delete(id);
    }
}