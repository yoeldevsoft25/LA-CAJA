import { useState, useEffect } from 'react';
import { connectivityService } from '@/services/connectivity.service';

export interface OnlineStatus {
    isOnline: boolean;
    wasOffline: boolean;
}

export function useOnline(): OnlineStatus {
    const [isOnline, setIsOnline] = useState(connectivityService.online);
    const [wasOffline, setWasOffline] = useState(false);

    useEffect(() => {
        // Initial state sync
        setIsOnline(connectivityService.online);

        // Subscribe to changes
        const unsubscribe = connectivityService.addListener((online) => {
            if (!online) {
                setWasOffline(true);
            }
            setIsOnline(online);
        });

        return unsubscribe;
    }, []);

    return { isOnline, wasOffline };
}

