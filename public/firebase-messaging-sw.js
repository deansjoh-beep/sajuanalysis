/* global importScripts, firebase */
// Firebase Cloud Messaging 서비스 워커.
// 백그라운드(앱이 포커스되지 않은 상태) 푸시 알림을 처리한다.
// 루트 경로(/firebase-messaging-sw.js)에서 서빙되어야 FCM이 인식한다.

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// 아래 값들은 모두 공개 가능한 클라이언트 설정이다 (firebase-applet-config.json 과 동일).
firebase.initializeApp({
  apiKey: 'AIzaSyCs4u0yThYOb5zzS8eEKlCt3Z4aQ5NnEVg',
  authDomain: 'gen-lang-client-0938860351.firebaseapp.com',
  projectId: 'gen-lang-client-0938860351',
  storageBucket: 'gen-lang-client-0938860351.firebasestorage.app',
  messagingSenderId: '995095255313',
  appId: '1:995095255313:web:94d56d817bd08182ad94b0',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || '오늘의 운세';
  const body = payload.notification?.body || payload.data?.body || '오늘의 운세가 도착했어요.';
  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: payload.data?.url || '/?tab=daily' },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/?tab=daily';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
      return undefined;
    }),
  );
});
