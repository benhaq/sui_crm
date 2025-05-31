module company::key_request {
    use std::{ascii::String, type_name};
    use sui::clock::Clock;

    /// KeyRequest object has all the info needed to access a key.
    public struct KeyRequest has key, store {
        id: UID,
        package: String, // Hex
        inner_id: vector<u8>,
        user: address,
        valid_till: u64,
    }

    /// Any contract can create a KeyRequest object associated with a given witness T (inaccessible to other contracts).
    /// ttl is the number of milliseconds after which the KeyRequest object expires.
    public fun request_key<T: drop>(
        _w: T,
        id: vector<u8>,
        user: address,
        c: &Clock,
        ttl: u64,
        ctx: &mut TxContext,
    ): KeyRequest {
        // The package of the caller (via the witness T).
        let package = type_name::get_with_original_ids<T>().get_address();
        KeyRequest {
            id: object::new(ctx),
            package,
            inner_id: id,
            user,
            valid_till: c.timestamp_ms() + ttl,
        }
    }

    public fun destroy(req: KeyRequest) {
        let KeyRequest { id, .. } = req;
        object::delete(id);
    }

    /// Verify that the KeyRequest is consistent with the given parameters, and that it has not expired.
    /// The dapp needs to call only this function in seal_approve.
    public fun verify<T: drop>(
        req: &KeyRequest,
        _w: T,
        id: vector<u8>,
        user: address,
        c: &Clock,
    ): bool {
        let package = type_name::get_with_original_ids<T>().get_address();
        (req.package == package) && (req.inner_id == id) && (req.user == user) && (c.timestamp_ms() <= req.valid_till)
    }

    #[test_only]
    public fun destroy_for_testing(req: KeyRequest) {
        let KeyRequest { id, .. } = req;
        object::delete(id);
    }
}