package ee.woodstar.shop.locker;

/** Port for opening a physical locker door. Implementations must be thread-safe. */
public interface LockerController {
    /** Pulses the relay; blocks until the device acknowledges or the RPC timeout elapses (≤ 5 s). */
    OpenResult open(String deviceId, int channel, int pulseSeconds);

    boolean isOnline(String deviceId);

    record OpenResult(boolean ok, String detail) {
        public static OpenResult success(String detail) { return new OpenResult(true, detail); }
        public static OpenResult failure(String detail) { return new OpenResult(false, detail); }
    }
}
