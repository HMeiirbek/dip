self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    
    let title = data.title || 'DIP Notification';
    let options = {
      body: data.body || 'You have a new notification.',
      icon: '/logo192.png',
      badge: '/logo192.png',
      data: data.data || {},
    };

    if (data.type === 'security') {
      options.requireInteraction = true;
    } else if (data.type === 'call_event') {
      options.requireInteraction = true;
      options.actions = [
        { action: 'answer', title: 'Answer' },
        { action: 'decline', title: 'Decline' }
      ];
    }

    event.waitUntil(self.registration.showNotification(title, options));
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'answer') {
    event.waitUntil(
      clients.openWindow('/calls')
    );
  } else if (event.action === 'decline') {
    // declined
  } else {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});
