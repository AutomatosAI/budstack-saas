/**
 * Mock data generators for demo/testing purposes
 * These are pure functions that can be used on both server and client
 */

// ============================================
// Notification Types & Generator
// ============================================

export type NotificationType = 'PENDING_APPROVAL' | 'FAILED_ORDER' | 'LOW_STOCK' | 'SYSTEM_ALERT' | 'USER_ACTION';

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    timestamp: Date;
    isRead: boolean;
    actionUrl?: string;
}

/**
 * Generate mock notifications for testing/demo
 */
export function generateMockNotifications(count: number = 10): Notification[] {
    const types: NotificationType[] = ['PENDING_APPROVAL', 'FAILED_ORDER', 'LOW_STOCK', 'SYSTEM_ALERT', 'USER_ACTION'];
    const titles: Record<NotificationType, string[]> = {
        PENDING_APPROVAL: ['New tenant application', 'Consultation request pending', 'Approval required'],
        FAILED_ORDER: ['Payment processing failed', 'Order fulfillment error', 'Delivery failed'],
        LOW_STOCK: ['Product stock critical', 'Inventory alert', 'Restock needed'],
        SYSTEM_ALERT: ['System maintenance scheduled', 'Security update available', 'Performance alert'],
        USER_ACTION: ['Profile updated successfully', 'Settings saved', 'Export completed'],
    };

    return Array.from({ length: count }, (_, i) => {
        const type = types[Math.floor(Math.random() * types.length)];
        const titleOptions = titles[type];
        const title = titleOptions[Math.floor(Math.random() * titleOptions.length)];

        return {
            id: `notif-${i}`,
            type,
            title,
            message: `This is a notification message for ${title.toLowerCase()}. It provides additional context about what happened.`,
            timestamp: new Date(Date.now() - Math.random() * 86400000 * 3), // Random time within last 3 days
            isRead: Math.random() > 0.6, // 40% unread
            actionUrl: Math.random() > 0.5 ? `/admin/notification/${i}` : undefined,
        };
    });
}

// ============================================
// Timeline Event Types & Generator
// ============================================

export type EventType =
    | 'TENANT_CREATED'
    | 'TENANT_ACTIVATED'
    | 'USER_REGISTERED'
    | 'ORDER_PLACED'
    | 'TENANT_SETTINGS_UPDATED'
    | 'SYSTEM_ALERT';

export interface TimelineEvent {
    id: string;
    type: EventType;
    description: string;
    timestamp: Date;
    actor?: string;
    metadata?: Record<string, any>;
}

/**
 * Generate mock timeline events for testing/demo purposes
 */
export function generateMockEvents(count: number = 20): TimelineEvent[] {
    const eventTypes: EventType[] = [
        'TENANT_CREATED',
        'TENANT_ACTIVATED',
        'USER_REGISTERED',
        'ORDER_PLACED',
        'TENANT_SETTINGS_UPDATED',
        'SYSTEM_ALERT'
    ];

    const descriptions: Record<EventType, string[]> = {
        TENANT_CREATED: [
            'New tenant "Green Leaf Dispensary" created',
            'Cannabis Co. signed up for platform',
            'Healing Herbs Store registered'
        ],
        TENANT_ACTIVATED: [
            'Happy Buds activated and went live',
            'Ocean View Cannabis approved and activated',
            'Mountain High Dispensary now active'
        ],
        USER_REGISTERED: [
            'New admin user Sarah J. registered',
            'Staff member Mike T. joined the platform',
            'Customer Emma W. created account'
        ],
        ORDER_PLACED: [
            'Order #1247 placed for $127.50',
            'New order #1248 - 3 items, $85.00',
            'Order #1249 submitted - $210.00'
        ],
        TENANT_SETTINGS_UPDATED: [
            'Branding updated for Coastal Cannabis',
            'Payment settings configured',
            'Store hours modified'
        ],
        SYSTEM_ALERT: [
            'Payment processing delay detected',
            'High API usage from tenant #42',
            'Scheduled maintenance in 2 hours'
        ]
    };

    const actors = [
        'System',
        'Sarah Johnson',
        'Mike Thompson',
        'Admin',
        'Emma Wilson',
        'Platform Bot',
        'John Doe'
    ];

    const events: TimelineEvent[] = [];

    for (let i = 0; i < count; i++) {
        const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        const descArray = descriptions[type];
        const description = descArray[Math.floor(Math.random() * descArray.length)];

        // Generate realistic timestamps (recent events)
        const minutesAgo = Math.floor(Math.random() * 240); // Up to 4 hours ago
        const timestamp = new Date(Date.now() - minutesAgo * 60000);

        events.push({
            id: `event-${i}-${Date.now()}`,
            type,
            description,
            timestamp,
            actor: Math.random() > 0.3 ? actors[Math.floor(Math.random() * actors.length)] : undefined
        });
    }

    // Sort by timestamp descending (most recent first)
    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}
