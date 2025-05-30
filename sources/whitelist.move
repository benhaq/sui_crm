module company::whitelist {
    use sui::vec_set::{Self, VecSet};
    use sui::clock::Clock;
    use company::key_request::{Self, KeyRequest};
    use company::errors;
    use company::events::{emit_whitelist_created};

    const TTL: u64 = 86_399_000; // ~24 hours in milliseconds (1 day)
    
    public struct WITNESS has drop {}

    // Event Struct


    public struct Whitelist has key {
        id: UID,
        users: VecSet<address>,
    }

    public fun create_whitelist(users: vector<address>, ctx: &mut TxContext): Whitelist {
        let mut users_set = vec_set::empty<address>();
        let mut i = 0;
        let initial_count = users.length();
        while (i < initial_count) {
            vec_set::insert(&mut users_set, *vector::borrow(&users, i));
            i = i + 1;
        };
        let wl = Whitelist {
            id: object::new(ctx),
            users: users_set,
        };

        emit_whitelist_created(object::id(&wl), initial_count);

        wl
    }

    public fun namespace(whitelist: &Whitelist): vector<u8> {
        whitelist.id.to_bytes()
    }

    public fun is_whitelisted(wl: &Whitelist, user: address): bool {
        wl.users.contains(&user)
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
        let Whitelist { id, users: _ } = wl;
        object::delete(id);
    }
}