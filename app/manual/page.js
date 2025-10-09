// app/manual/page.js
'use client';
import useAppStore from '@/store/useAppStore';
import Header from '@/components/Header';
import styles from './Manual.module.css';

export default function ManualPage() {
  const { user, openCoinModal, openProfileModal } = useAppStore();
  const userCoins = useAppStore((state) => state.userCoins);

  return (
    <>
      <Header 
        user={user} 
        userCoins={userCoins}
        onAvatarClick={openProfileModal}
        onCoinClick={openCoinModal}
      />
      <main className={styles.main}>
        
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>1. 시작하기</h2>
          <div className={styles.card}>
            <h3>1.1. 로그인</h3>
            <p>Google 계정을 사용하여 간편하게 로그인하고 취향캠톡의 모든 기능을 이용할 수 있습니다.</p>
          </div>
          <div className={styles.card}>
            <h3>1.2. 프로필 설정</h3>
            <p>우측 상단의 프로필 아이콘을 클릭하여 닉네임과 프로필 사진을 자유롭게 변경할 수 있습니다. 멋진 프로필로 자신을 표현해보세요.</p>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>2. 일반 사용자 안내</h2>
          <div className={styles.card}>
            <h3>2.1. 메인 화면</h3>
            <p>메인 화면에서는 내가 팔로우한 크리에이터와 전체 크리에이터 랭킹을 확인할 수 있습니다. 'Call' 버튼을 눌러 온라인 상태인 크리에이터에게 영상 통화를 신청해 보세요.</p>
          </div>
          <div className={styles.card}>
            <h3>2.2. 코인 충전</h3>
            <p>우측 상단의 코인 정보 또는 프로필 수정 창의 '코인 충전' 버튼을 통해 충전을 요청할 수 있습니다. 관리자 승인 후 코인이 지급됩니다.</p>
          </div>
          <div className={styles.card}>
            <h3>2.3. 영상 통화</h3>
            <p>크리에이터에게 영상 통화를 걸면 코인이 소모됩니다. 통화 중에는 마이크와 카메라를 켜고 끌 수 있으며, '🎁' 버튼을 눌러 크리에이터에게 선물을 보낼 수도 있습니다.</p>
          </div>
           <div className={styles.card}>
            <h3>2.4. 후기 남기기</h3>
            <p>크리에이터와의 통화가 종료되면 해당 크리에이터에 대한 별점과 후기를 남길 수 있습니다. 여러분의 소중한 후기는 랭킹에 반영됩니다.</p>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>3. 크리에이터 안내</h2>
          <div className={styles.card}>
            <h3>3.1. 크리에이터 되기</h3>
            <p>크리에이터는 관리자가 지정해야 될 수 있습니다. 크리에이터가 되면 특별한 기능들을 사용할 수 있습니다.</p>
          </div>
          <div className={styles.card}>
            <h3>3.2. 온라인 상태 관리</h3>
            <p>크리에이터는 메인 화면의 'Go Online' 버튼을 눌러 통화 대기 상태로 전환할 수 있습니다. 통화를 받을 수 없는 상태일 경우 'Go Offline'을 눌러주세요.</p>
          </div>
          <div className={styles.card}>
            <h3>3.3. 프로필 페이지 관리</h3>
            <p>자신의 프로필 페이지에서 '소개 수정' 버튼을 통해 자기소개를 작성하고, '+ 사진 추가' 버튼으로 사진첩을 꾸밀 수 있습니다. 사진첩의 사진 순서는 드래그 앤 드롭으로 변경할 수 있습니다.</p>
          </div>
           <div className={styles.card}>
            <h3>3.4. 수익 정산</h3>
            <p>사용자와 영상 통화를 하거나 선물을 받으면 설정된 정산 비율에 따라 코인을 얻게 됩니다. 적립된 코인은 관리자에게 문의하여 정산받을 수 있습니다.</p>
          </div>
        </section>

      </main>
    </>
  );
}