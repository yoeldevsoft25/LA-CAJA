
import { ReconnectSyncOrchestrator, ReconnectTelemetry } from '../reconnect-orchestrator';

describe('ReconnectSyncOrchestrator', () => {
    let orchestrator: ReconnectSyncOrchestrator;
    let syncCallback: jest.Mock;
    let telemetry: ReconnectTelemetry;

    beforeEach(() => {
        // Mock browser environment
        global.window = {
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        } as any;
        global.document = {
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            visibilityState: 'visible',
        } as any;
        global.navigator = {
            onLine: true,
        } as any;

        jest.useFakeTimers();
        syncCallback = jest.fn().mockResolvedValue(undefined);
        telemetry = {
            onReconnectDetected: jest.fn(),
            onSyncStarted: jest.fn(),
            onSyncSuccess: jest.fn(),
            onSyncFailed: jest.fn(),
        };
        orchestrator = new ReconnectSyncOrchestrator({ debounceMs: 1000, throttleMs: 2000 });
    });

    afterEach(() => {
        orchestrator.destroy();
        jest.useRealTimers();
    });

    it('should attach listeners and trigger sync on online event with debounce', async () => {
        orchestrator.init(syncCallback, telemetry);

        // Simulate online event by calling the handler directly (since real dispatchEvent won't work with mock)
        // Access private handler via any cast or if we mock addEventListener implementation to capture it
        // Better: Capture listener
        const onlineHandler = (global.window.addEventListener as jest.Mock).mock.calls.find(c => c[0] === 'online')[1];
        onlineHandler();

        expect(telemetry.onReconnectDetected).toHaveBeenCalledWith('online');
        expect(syncCallback).not.toHaveBeenCalled(); // Debounce

        // Fast forward debounce
        jest.advanceTimersByTime(1000);
        await Promise.resolve(); // Flush promises

        expect(syncCallback).toHaveBeenCalled();
        expect(telemetry.onSyncStarted).toHaveBeenCalledWith('online');
        expect(telemetry.onSyncSuccess).toHaveBeenCalledWith('online');
    });

    it('should debounce multiple rapid events', () => {
        orchestrator.init(syncCallback, telemetry);

        const onlineHandler = (global.window.addEventListener as jest.Mock).mock.calls.find(c => c[0] === 'online')[1];
        const focusHandler = (global.window.addEventListener as jest.Mock).mock.calls.find(c => c[0] === 'focus')[1];

        onlineHandler();
        jest.advanceTimersByTime(500);
        focusHandler(); // Reset timer
        jest.advanceTimersByTime(500);

        expect(syncCallback).not.toHaveBeenCalled();

        jest.advanceTimersByTime(500); // Total 1000ms from last event
        expect(syncCallback).toHaveBeenCalledTimes(1);
        expect(telemetry.onReconnectDetected).toHaveBeenCalledTimes(2);
    });

    it('should prevent sync if throttle period has not passed', async () => {
        orchestrator.init(syncCallback, telemetry);
        const onlineHandler = (global.window.addEventListener as jest.Mock).mock.calls.find(c => c[0] === 'online')[1];
        const focusHandler = (global.window.addEventListener as jest.Mock).mock.calls.find(c => c[0] === 'focus')[1];

        // First sync
        onlineHandler();
        jest.advanceTimersByTime(1000);
        await Promise.resolve(); // Flush promises
        expect(syncCallback).toHaveBeenCalledTimes(1);

        // Second event immediately
        focusHandler();
        jest.advanceTimersByTime(1000);

        // Should be throttled
        expect(syncCallback).toHaveBeenCalledTimes(1);
    });

    it('should respect locking mechanism (no parallel syncs)', () => {
        let resolveSync: () => void;
        syncCallback.mockImplementation(() => new Promise<void>((resolve) => { resolveSync = resolve; }));

        orchestrator.init(syncCallback, telemetry);
        const onlineHandler = (global.window.addEventListener as jest.Mock).mock.calls.find(c => c[0] === 'online')[1];
        const focusHandler = (global.window.addEventListener as jest.Mock).mock.calls.find(c => c[0] === 'focus')[1];

        // Trigger first sync
        onlineHandler();
        jest.advanceTimersByTime(1000);
        expect(syncCallback).toHaveBeenCalledTimes(1);

        // Trigger 'parallel' sync while first is running
        // Move time forward past throttle to isolate locking test
        jest.setSystemTime(Date.now() + 5000);

        focusHandler();
        jest.advanceTimersByTime(1000);

        // Still running, should not call again
        expect(syncCallback).toHaveBeenCalledTimes(1);

        // Finish first sync
        resolveSync!();
    });
});
