// app/api/users/route.js
import { NextResponse } from 'next/server';
import admin from 'firebase-admin';

// 서비스 계정 키 파싱
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;

// Firebase Admin 앱 초기화 (이미 초기화되지 않은 경우에만)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: databaseURL
  });
}

export async function GET() {
  try {
    const userRecords = await admin.auth().listUsers();
    const users = userRecords.users.map((user) => ({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      creationTime: user.metadata.creationTime,
    }));
    return NextResponse.json(users);
  } catch (error) {
    console.error('Error listing users:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}