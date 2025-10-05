// app/api/turn/route.js
import { NextResponse } from 'next/server';
import twilio from 'twilio';

export async function GET() {
  // Vercel에 설정된 환경 변수에서 계정 정보를 가져옵니다.
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  // 환경 변수가 없으면 에러를 반환합니다.
  if (!accountSid || !authToken) {
    return new NextResponse("Twilio credentials are not set in environment variables.", { status: 500 });
  }

  const client = twilio(accountSid, authToken);

  try {
    // Twilio에 24시간 동안 유효한 임시 TURN 서버 자격증명을 요청합니다.
    const token = await client.tokens.create({ ttl: 86400 }); 
    // 클라이언트(simple-peer)에서 사용할 수 있는 형태로 반환합니다.
    return NextResponse.json({ iceServers: token.iceServers });
  } catch (error) {
    console.error("Failed to fetch TURN credentials from Twilio:", error);
    return new NextResponse("Failed to fetch TURN credentials.", { status: 500 });
  }
}