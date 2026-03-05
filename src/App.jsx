import { useState, useRef, useEffect, useMemo } from 'react';
import { Gamepad2, Plus, List, BarChart2, Trophy, ChevronLeft, Check, Trash2, ShieldAlert, Users, X, Flag, Edit, Lock, Unlock, Search, CalendarPlus, Shield, UserCheck, ShieldClose, UserX, MessageSquare, AlertOctagon, PieChart, BarChart, Bell, ArrowUpDown, Swords, Info} from 'lucide-react';
import { db } from './firebase'; 
import { collection, doc, setDoc, getDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore'; 

const yakuData = {
  '1판 역': ['리치', '일발', '멘젠쯔모', '탕야오', '핑후', '이페코', '백', '발', '중', '자풍패', '장풍패', '해저로월', '하저로어', '영상개화', '창깡'],
  '2판 역': ['더블리치', '치또이쯔', '일기통관', '삼색동순', '삼색동각', '또이또이', '산안커', '찬타', '소삼원', '혼노두', '산깡쯔'],
  '3판 역': ['혼일색', '준찬타', '량페코'],
  '6판 역': ['청일색'],
  '역만': ['천화', '지화', '인화', '스안커', '국사무쌍', '대삼원', '구련보등', '소사희', '자일색', '녹일색', '청노두', '스깡쯔', '대차륜', '대죽림', '대수린', '석상삼년'],
  '더블역만': ['대사희', '스안커 단기', '국사무쌍 13면', '순정구련보등', '홍공작', '대칠성']
}

const hasYakuman = (game) => {
  if (!game || !game.rounds || !Array.isArray(game.rounds)) return false;
  return game.rounds.some(r => {
    if (r?.type !== '화료') return false;
    
    // 1. 판수 체크 (13판 이상)
    if (Number(r?.han || 0) >= 13) return true;
    
    // 2. 역 리스트 체크 (역만/더블역만 포함 여부)
    const selected = r?.selectedYaku || [];
    if (!Array.isArray(selected)) return false;
    
    return selected.some(y => 
      (yakuData['역만']?.includes(y)) || (yakuData['더블역만']?.includes(y))
    );
  });
};

const targetFuroYaku = ['일기통관', '삼색동순', '찬타', '준찬타', '혼일색', '청일색'];
const menzenOnlyYaku = ['리치', '일발', '멘젠쯔모', '핑후', '이페코', '더블리치', '치또이쯔', '량페코', '천화', '지화', '인화', '스안커', '국사무쌍', '구련보등', '대차륜', '대죽림', '대수린', '석상삼년', '스안커 단기', '국사무쌍 13면', '순정구련보등', '대칠성'];
const abortiveDraws = ['구종구패', '사풍연타', '사깡유국', '사가리치'];
const ADMIN_PIN = '0000';

const getMahjongScore = (han, fu, isDealer, isTsumo, honba = 0, is3Player = false) => {
  let base = 0;
  if (han >= 13) base = 8000;
  else if (han >= 11) base = 6000;
  else if (han >= 8) base = 4000;
  else if (han >= 6) base = 3000;
  else if (han >= 5) base = 2000;
  else {
    base = fu * Math.pow(2, han + 2);
    if (base > 2000) base = 2000;
  }

  const hb = honba * 100;
  let pureTotal = 0;
  let display = "";

  if (isDealer) {
    if (isTsumo) {
      const pay = Math.ceil((base * 2) / 100) * 100;
      pureTotal = pay * (is3Player ? 2 : 3);
      display = `${pay + hb} ALL`;
    } else {
      const pay = Math.ceil((base * 6) / 100) * 100;
      pureTotal = pay;
      display = `${pay + hb * (is3Player ? 2 : 3)}`;
    }
  } else {
    if (isTsumo) {
      const dPay = Math.ceil((base * 2) / 100) * 100;
      const ndPay = Math.ceil(base / 100) * 100;
      pureTotal = dPay + ndPay * (is3Player ? 1 : 2);
      display = `${ndPay + hb}/${dPay + hb}`;
    } else {
      const pay = Math.ceil((base * 4) / 100) * 100;
      pureTotal = pay;
      display = `${pay + hb * (is3Player ? 2 : 3)}`;
    }
  }

  return { pureTotal, display };
};

function App() {
  const [activeTooltip, setActiveTooltip] = useState(null);
  const [activeTab, setActiveTab] = useState('전체');
  const [activeNav, setActiveNav] = useState('기록');
  
  const [games, setGames] = useState([]); 
  const [seasons, setSeasons] = useState([{ id: 'season_2', name: '시즌 2' }]); 
  const [isLoading, setIsLoading] = useState(true);

  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('mahjong_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login'); 
  const [authName, setAuthName] = useState(''); const [authPin, setAuthPin] = useState(''); const [authRoleReq, setAuthRoleReq] = useState('player'); 
  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
  const [allUsers, setAllUsers] = useState([]);

  const canWrite = currentUser ? (currentUser.role === 'master' || currentUser.isApproved || currentUser.isApproved === undefined) : false;
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'master';
  const isMaster = currentUser?.role === 'master';

  // 💡 라이벌 전적용 상태
  const [rival1, setRival1] = useState('');
  const [rival2, setRival2] = useState('');

  useEffect(() => {
    const qGames = query(collection(db, 'games'), orderBy('id', 'desc'));
    const unsubGames = onSnapshot(qGames, (snapshot) => { setGames(snapshot.docs.map(doc => doc.data())); setIsLoading(false); });
    const unsubSeasons = onSnapshot(doc(db, 'settings', 'seasons'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().list) setSeasons(docSnap.data().list);
      else setDoc(doc(db, 'settings', 'seasons'), { list: [{ id: 'season_free', name: '프리 시즌', startDate: '', endDate: '' }] });
    });
    return () => { unsubGames(); unsubSeasons(); };
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const unsubUser = onSnapshot(doc(db, 'users', currentUser.name), (docSnap) => {
      if (docSnap.exists()) {
        const updatedUser = docSnap.data(); setCurrentUser(updatedUser); localStorage.setItem('mahjong_user', JSON.stringify(updatedUser));
      } else {
        setCurrentUser(null); localStorage.removeItem('mahjong_user'); alert('계정이 관리자에 의해 삭제되었습니다.');
      }
    });
    return () => unsubUser();
  }, [currentUser?.name]);

  useEffect(() => {
    if (!isMaster) return;
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => setAllUsers(snapshot.docs.map(d => d.data())));
    return () => unsubUsers();
  }, [isMaster]);

  const handleSignup = async () => {
    if (!authName.trim() || !/^\d{4}$/.test(authPin)) return alert('이름과 4자리 숫자 PIN을 정확히 입력해주세요.');
    const userRef = doc(db, 'users', authName); const userSnap = await getDoc(userRef);
    if (userSnap.exists()) return alert('이미 존재하는 이름입니다. 로그인해주세요.');
    let initialRole = 'player'; let isPending = false; let approved = false;
    if (authName === 'ywc1014') { initialRole = 'master'; approved = true; alert('최고 관리자(마스터) 계정이 생성되었습니다!'); } 
    else if (authRoleReq === 'admin') { isPending = true; alert('가입 완료! 쓰기 및 관리자 권한은 마스터의 승인이 필요합니다.'); } 
    else { alert('가입 완료! 대국 기록을 추가하려면 마스터의 승인이 필요합니다.'); }
    const newUser = { name: authName, pin: authPin, role: initialRole, pendingAdmin: isPending, isApproved: approved };
    await setDoc(userRef, newUser);
    setCurrentUser(newUser); localStorage.setItem('mahjong_user', JSON.stringify(newUser));
    setIsAuthModalOpen(false); setAuthName(''); setAuthPin('');
  };

  const handleLogin = async () => {
    if (!authName.trim() || !authPin) return alert('이름과 PIN을 입력해주세요.');
    const userRef = doc(db, 'users', authName); const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return alert('존재하지 않는 유저입니다. 회원가입을 진행해주세요.');
    const userData = userSnap.data();
    if (userData.pin !== authPin) return alert('PIN 번호가 일치하지 않습니다.');
    setCurrentUser(userData); localStorage.setItem('mahjong_user', JSON.stringify(userData));
    setIsAuthModalOpen(false); setAuthName(''); setAuthPin('');
  };

  const handleLogout = () => { setCurrentUser(null); localStorage.removeItem('mahjong_user'); };
  const handleApproveUser = async (name) => { await updateDoc(doc(db, 'users', name), { isApproved: true }); };
  const handleApproveAdmin = async (name) => { await updateDoc(doc(db, 'users', name), { role: 'admin', pendingAdmin: false, isApproved: true }); };
  const handleRejectAdmin = async (name) => { await updateDoc(doc(db, 'users', name), { pendingAdmin: false }); };
  const handlePromoteAdmin = async (name) => { await updateDoc(doc(db, 'users', name), { role: 'admin' }); };
  const handleDemotePlayer = async (name) => { await updateDoc(doc(db, 'users', name), { role: 'player' }); };
  const handleRemoveUser = async (name) => { if(confirm(`${name} 유저를 완전히 삭제하시겠습니까?`)) await deleteDoc(doc(db, 'users', name)); };

  const [searchQuery, setSearchQuery] = useState('');
  const [gameFilter, setGameFilter] = useState('전체');
  const [selectedSeason, setSelectedSeason] = useState('all'); 
  const [isSeasonModalOpen, setIsSeasonModalOpen] = useState(false);
  
  const [newSeasonName, setNewSeasonName] = useState('');
  const [newSeasonStart, setNewSeasonStart] = useState('');
  const [newSeasonEnd, setNewSeasonEnd] = useState('');
  const [editingSeasonId, setEditingSeasonId] = useState(null);

  const handleSaveSeason = async () => {
    if (!newSeasonName.trim()) return alert("시즌 이름을 입력해주세요.");
    let newSeasonList;
    if (editingSeasonId) {
      newSeasonList = seasons.map(s => s.id === editingSeasonId ? { ...s, name: newSeasonName, startDate: newSeasonStart, endDate: newSeasonEnd } : s);
    } else {
      newSeasonList = [...seasons, { id: `season_${Date.now()}`, name: newSeasonName, startDate: newSeasonStart, endDate: newSeasonEnd }];
    }
    await setDoc(doc(db, 'settings', 'seasons'), { list: newSeasonList });
    setNewSeasonName(''); setNewSeasonStart(''); setNewSeasonEnd(''); setEditingSeasonId(null);
  };

  const handleEditSeasonClick = (season) => { setNewSeasonName(season.name); setNewSeasonStart(season.startDate || ''); setNewSeasonEnd(season.endDate || ''); setEditingSeasonId(season.id); };
  const handleCancelEditSeason = () => { setNewSeasonName(''); setNewSeasonStart(''); setNewSeasonEnd(''); setEditingSeasonId(null); };

  // App 내부 130라인 근처
  const displayedGames = (games || []).filter(g => {
    // 1. 탭 필터 (4인/3인)
    if (activeTab !== '전체' && g.type !== activeTab) return false;
    
    // 2. 시즌 필터
    if (selectedSeason !== 'all' && g.seasonId !== selectedSeason) return false;
    
    // 3. 검색어 필터
    if (searchQuery) {
      const matchDate = g.date?.includes(searchQuery);
      const matchPlayer = g.players?.some(p => p?.includes(searchQuery));
      if (!matchDate && !matchPlayer) return false;
    }

    // 4. 몰아보기 필터 (gameFilter)
    if (gameFilter === '역만') {
      return hasYakuman(g); // 이제 상단에 선언되어 있어 에러가 나지 않습니다.
    } 
    if (gameFilter === '촌보') {
      return g.rounds?.some(r => r.type === '촌보') ?? false;
    } 
    if (gameFilter === '코멘트') {
      return g.rounds?.some(r => r.comment && r.comment.trim() !== '') ?? false;
    }
    
    return true;
  });

  const getTodayStr = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  };

  const [selectedGameId, setSelectedGameId] = useState(null); 
  const [isNewGameModalOpen, setIsNewGameModalOpen] = useState(false);
  const [showNewGameMenu, setShowNewGameMenu] = useState(false);
  const [newGameType, setNewGameType] = useState('4인');
  const [newGameDate, setNewGameDate] = useState(getTodayStr()); // 💡 대국 일자 상태 추가
  const [playerE, setPlayerE] = useState(''); const [playerS, setPlayerS] = useState(''); const [playerW, setPlayerW] = useState(''); const [playerN, setPlayerN] = useState('');

  const [isEndGameModalOpen, setIsEndGameModalOpen] = useState(false);
  const [finalScores, setFinalScores] = useState([]);
  const [isRoundModalOpen, setIsRoundModalOpen] = useState(false);
  const [recordMode, setRecordMode] = useState('화료'); 
  const [wind, setWind] = useState('동'); const [roundNum, setRoundNum] = useState(1); const [honba, setHonba] = useState(0); const [kyotaku, setKyotaku] = useState(0); 
  const [winType, setWinType] = useState('쯔모'); const [winner, setWinner] = useState(null); const [loser, setLoser] = useState(null); 
  const [waitType, setWaitType] = useState('양면'); const [menzen, setMenzen] = useState('멘젠');
  const [dora, setDora] = useState(0); const [aka, setAka] = useState(0); const [ura, setUra] = useState(0); const [pei, setPei] = useState(0);
  const [fu, setFu] = useState(30); const [han, setHan] = useState(1); const [score, setScore] = useState('');
  const [selectedYaku, setSelectedYaku] = useState([]); const [furoDecreased, setFuroDecreased] = useState([]); 
  const [tenpaiPlayers, setTenpaiPlayers] = useState([]); const [nagashiMangan, setNagashiMangan] = useState([]); const [abortiveType, setAbortiveType] = useState(null); 
  const [roundComment, setRoundComment] = useState(''); const [chomboPlayer, setChomboPlayer] = useState(null); 
  const [editingRoundId, setEditingRoundId] = useState(null);

  const currentGame = games.find(g => g.id === selectedGameId);
  const records = currentGame ? currentGame.rounds : [];
  const players = currentGame ? currentGame.players : [];

  const totalRecords = records.length;
  const winRecords = records.filter(r => r.type === '화료');
  const tsumoCount = winRecords.filter(r => r.winType === '쯔모').length;
  const ronCount = winRecords.filter(r => r.winType === '론').length;
  const drawCount = records.filter(r => r.type === '유국').length; 

  // 💡 판수 자동 계산 로직 (비멘젠 시 후로 감소 자동 적용)
  // 💡 판수 자동 계산 로직 (비멘젠 시 후로 감소 자동 적용)
  useEffect(() => {
    if (recordMode !== '화료') return;
    let calcHan = 0;
    selectedYaku.forEach(y => {
      if (yakuData['1판 역']?.includes(y)) calcHan += 1;
      else if (yakuData['2판 역']?.includes(y)) calcHan += 2;
      else if (yakuData['3판 역']?.includes(y)) calcHan += 3;
      else if (yakuData['6판 역']?.includes(y)) calcHan += 6;
      else if (yakuData['역만']?.includes(y)) calcHan += 13; 
      else if (yakuData['더블역만']?.includes(y)) calcHan += 26;

      // 비멘젠 상태일 때 후로 감소 역이면 1판 차감
      if (menzen === '비멘젠' && targetFuroYaku.includes(y)) calcHan -= 1;
    });
    calcHan += dora + aka + ura;
    if (activeTab === '3인' || currentGame?.type === '3인') calcHan += pei;
    setHan(calcHan > 0 ? calcHan : 1);
  }, [selectedYaku, dora, aka, ura, pei, activeTab, currentGame, recordMode, menzen]);

  // 💡 비멘젠 전환 시, 선택되어 있던 멘젠 전용 역들을 자동으로 해제
  useEffect(() => {
    if (menzen === '비멘젠') {
      setSelectedYaku(prev => prev.filter(y => !menzenOnlyYaku.includes(y)));
    }
  }, [menzen]);

  const playerTimerRef = useRef(null);
  const isPlayerLongPressRef = useRef(false);

  // 💡 화료/방총자 0.3초 롱프레스 로직 (PC 마우스, 모바일 터치 동시 지원)
  const handlePlayerPressStart = (index) => {
    isPlayerLongPressRef.current = false;
    playerTimerRef.current = setTimeout(() => {
      isPlayerLongPressRef.current = true;
      if (winType === '론') {
        setLoser(index);
        if (winner === index) setWinner(null);
      }
    }, 300); // 300ms (0.3초)
  };
  const handlePlayerPressEnd = () => {
    if (playerTimerRef.current) clearTimeout(playerTimerRef.current);
  };
  const handlePlayerClick = (index) => {
    if (isPlayerLongPressRef.current) return; // 롱프레스였다면 일반 클릭은 무시
    setWinner(index);
    if (loser === index) setLoser(null);
  };

  const handleWinTypeChange = (type) => { setWinType(type); if (type === '쯔모') setLoser(null); };

  // 💡 역 선택 토글 (비멘젠 상태일 때 멘젠 전용 역은 클릭 무시, 후로 감소는 100% 자동화)
  const toggleYaku = (yaku) => {
    if (menzen === '비멘젠' && menzenOnlyYaku.includes(yaku)) return;
    setSelectedYaku(prev => prev.includes(yaku) ? prev.filter(y => y !== yaku) : [...prev, yaku]);
  };

  const toggleTenpai = (index) => { setTenpaiPlayers(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]); setAbortiveType(null); };
  const toggleNagashi = (index) => setNagashiMangan(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]);
  const toggleAbortive = (type) => { setAbortiveType(prev => prev === type ? null : type); if (abortiveType !== type) setTenpaiPlayers([]); };  

  const handleCreateNewGame = async () => {
    const gameType = newGameType; 
    if (!newGameDate) return alert("대국 일자를 입력해주세요!");
    if (gameType === '4인' && (!playerE || !playerS || !playerW || !playerN)) return alert("모든 플레이어 이름을 입력해주세요!");
    if (gameType === '3인' && (!playerE || !playerS || !playerW)) return alert("모든 플레이어 이름을 입력해주세요!");
    
    // 💡 직접 선택한 날짜(newGameDate)를 기준으로 시즌 탐색
    let matchedSeasonId = null;
    for (let i = seasons.length - 1; i >= 0; i--) {
      const s = seasons[i];
      if (s.startDate && s.endDate && newGameDate >= s.startDate && newGameDate <= s.endDate) {
        matchedSeasonId = s.id; break;
      }
    }
    
    if (!matchedSeasonId) {
      const preSeason = seasons.find(s => s.name === "프리 시즌");
      if (preSeason) matchedSeasonId = preSeason.id;
      else matchedSeasonId = seasons[seasons.length - 1].id;
    }

    // YYYY-MM-DD 를 YYYY. MM. DD. 로 변환
    const formattedDate = newGameDate.split('-').join('. ') + '.';

    const newGame = { 
      id: Date.now(), 
      seasonId: matchedSeasonId,
      date: formattedDate, 
      type: gameType, 
      players: gameType === '4인' ? [playerE, playerS, playerW, playerN] : [playerE, playerS, playerW], 
      rounds: [], status: '진행중', finalResults: null 
    };
    
    await setDoc(doc(db, 'games', newGame.id.toString()), newGame);
    setIsNewGameModalOpen(false); setSelectedGameId(newGame.id); setActiveNav('기록'); 
    setPlayerE(''); setPlayerS(''); setPlayerW(''); setPlayerN(''); setNewGameDate(getTodayStr()); // 생성 후 오늘로 초기화
  };

  const handleOpenNewRound = () => {
    setEditingRoundId(null);
    let defaultWind = '동'; let defaultRoundNum = 1; let defaultHonba = 0;
    
    // 💡 지능형 라운드(국/본장) 자동 설정 로직
    if (currentGame && currentGame.rounds && currentGame.rounds.length > 0) {
      const lastRound = currentGame.rounds[0]; 
      const maxRound = currentGame.type === '3인' ? 3 : 4;
      
      defaultWind = lastRound.wind;
      defaultRoundNum = lastRound.roundNum;
      defaultHonba = lastRound.honba;

      // 직전 라운드의 친(Dealer) 알아내기
      const dealerIndex = (lastRound.roundNum - 1) % currentGame.players.length;
      const dealerName = currentGame.players[dealerIndex];

      if (lastRound.type === '촌보') {
        // 1. 촌보: 국풍, 국 번호, 본장 모두 유지
        defaultWind = lastRound.wind;
        defaultRoundNum = lastRound.roundNum;
        defaultHonba = lastRound.honba;
      } else if (lastRound.type === '화료') {
        if (lastRound.winner === dealerName) {
          // 2. 친 화료: 연장 (국 유지, 본장 +1)
          defaultHonba = lastRound.honba + 1;
        } else {
          // 3. 자 화료: 다음 국으로 (본장 0으로 초기화)
          defaultHonba = 0;
          defaultRoundNum = lastRound.roundNum + 1;
        }
      } else if (lastRound.type === '유국') {
        if (lastRound.abortiveType) {
          // 4. 도중유국: 연장 (국 유지, 본장 +1)
          defaultHonba = lastRound.honba + 1;
        } else if (lastRound.tenpaiPlayers && lastRound.tenpaiPlayers.includes(dealerName)) {
          // 5. 황패유국 (친 텐파이): 연장 (국 유지, 본장 +1)
          defaultHonba = lastRound.honba + 1;
        } else {
          // 6. 황패유국 (친 노텐): 다음 국으로 (본장 +1 누적)
          defaultHonba = lastRound.honba + 1;
          defaultRoundNum = lastRound.roundNum + 1;
        }
      }

      // 💡 국 번호가 최대(4인:4, 3인:3)를 넘어가면 다음 장풍으로 변경
      if (defaultRoundNum > maxRound) {
        defaultRoundNum = 1;
        if (defaultWind === '동') defaultWind = '남';
        else if (defaultWind === '남') defaultWind = '서';
        else if (defaultWind === '서') defaultWind = '북';
      }
    }

    setRecordMode('화료'); setWind(defaultWind); setRoundNum(defaultRoundNum); setHonba(defaultHonba); setKyotaku(0);
    setWinType('쯔모'); setWinner(null); setLoser(null); setWaitType('양면'); setMenzen('멘젠');
    setDora(0); setAka(0); setUra(0); setPei(0); setFu(30); setHan(1); setScore('');
    setSelectedYaku([]); setFuroDecreased([]); setTenpaiPlayers([]); setNagashiMangan([]);
    setAbortiveType(null); setRoundComment(''); setChomboPlayer(null); 
    setIsRoundModalOpen(true);
  };

  // 💡 삭제되었던 라운드 수정 함수 복구 및 데이터 보호 로직 추가
  const handleEditRound = (record) => {
    setEditingRoundId(record.id);
    setRecordMode(record.type || '화료'); 
    setWind(record.wind || '동'); 
    setRoundNum(record.roundNum || 1); 
    setHonba(record.honba || 0); 
    setKyotaku(record.kyotaku || 0);
    
    if (record.type === '화료') {
      setWinType(record.winType || '쯔모'); 
      setWinner(record.winner ? players.indexOf(record.winner) : null); 
      setLoser(record.loser ? players.indexOf(record.loser) : null);
      setWaitType(record.waitType || '양면'); 
      setMenzen(record.menzen || '멘젠');
      setDora(record.dora || 0); 
      setAka(record.aka || 0); 
      setUra(record.ura || 0); 
      setPei(record.pei || 0);
      setFu(record.fu || 30); 
      setHan(record.han || 1); 
      setScore(record.score || '');
      setSelectedYaku(record.selectedYaku || []); 
      setFuroDecreased(record.furoDecreased || []);
    } else if (record.type === '유국') {
      setTenpaiPlayers(record.tenpaiPlayers ? record.tenpaiPlayers.map(p => players.indexOf(p)).filter(i => i !== -1) : []);
      setNagashiMangan(record.nagashiMangan ? record.nagashiMangan.map(p => players.indexOf(p)).filter(i => i !== -1) : []);
      setAbortiveType(record.abortiveType || null);
    } else if (record.type === '촌보') {
      setChomboPlayer(record.chomboPlayer ? players.indexOf(record.chomboPlayer) : null);
    }
    setRoundComment(record.comment || '');
    setIsRoundModalOpen(true);
  };

  // 💡 저장 함수도 안전하게 덮어씌움
  const handleSaveRound = async () => {
    let newRound = { id: editingRoundId || Date.now(), wind, roundNum, honba, kyotaku, type: recordMode, comment: roundComment };
    
    if (recordMode === '화료') {
      if (winner === null || winner === -1) return alert("화료자를 선택해주세요!");
      if (winType === '론' && (loser === null || loser === -1)) return alert("방총자를 입력하지 않았습니다"); 
      
      newRound = { 
        ...newRound, winType, menzen, waitType, 
        winner: players[winner], 
        loser: loser !== null && loser !== -1 ? players[loser] : null, 
        selectedYaku, furoDecreased, dora, aka, ura, pei, fu, han, score 
      };
    } else if (recordMode === '유국') {
      newRound = { 
        ...newRound, 
        tenpaiPlayers: tenpaiPlayers.map(i => players[i]).filter(Boolean), 
        nagashiMangan: nagashiMangan.map(i => players[i]).filter(Boolean), 
        abortiveType 
      };
    } else if (recordMode === '촌보') {
      if (chomboPlayer === null || chomboPlayer === -1) return alert("촌보 발생자를 선택해주세요!");
      newRound = { ...newRound, chomboPlayer: players[chomboPlayer] };
    }
    
    try {
      const updatedRounds = editingRoundId 
        ? currentGame.rounds.map(r => r.id === editingRoundId ? newRound : r)
        : [newRound, ...currentGame.rounds];

      await setDoc(doc(db, 'games', selectedGameId.toString()), { ...currentGame, rounds: updatedRounds });
      
      setIsRoundModalOpen(false); 
      setEditingRoundId(null);
      setWinner(null); setLoser(null); setSelectedYaku([]); setFuroDecreased([]); setDora(0); setAka(0); setUra(0); setPei(0); setTenpaiPlayers([]); setNagashiMangan([]); setAbortiveType(null); setRoundComment(''); setScore(''); setChomboPlayer(null);
    } catch (error) {
      console.error("라운드 저장 실패:", error);
      alert("데이터베이스 저장 중 문제가 발생했습니다.");
    }
  };

  const handleDeleteRound = async (roundId) => { if(confirm("이 국의 기록을 삭제하시겠습니까?")) await setDoc(doc(db, 'games', selectedGameId.toString()), { ...currentGame, rounds: currentGame.rounds.filter(r => r.id !== roundId) }); };
  const handleDeleteGame = async (e, gameId) => { e.stopPropagation(); if(confirm("이 대국의 전체 기록을 삭제하시겠습니까? 복구할 수 없습니다.")) { await deleteDoc(doc(db, 'games', gameId.toString())); if(selectedGameId === gameId) setSelectedGameId(null); } };

  const handleOpenEndGame = () => {
    if (currentGame.finalResults) setFinalScores(currentGame.finalResults.map(f => ({ score: String(f.score) })));
    else setFinalScores(players.map(() => ({ score: '' })));
    setIsEndGameModalOpen(true);
  };
  const updateFinalScore = (index, value) => { setFinalScores(prev => prev.map((item, i) => i === index ? { ...item, score: value } : item)); };

  const handleConfirmEndGame = async () => {
    if (finalScores.some(f => f.score === '')) return alert("모든 플레이어의 소점을 입력해주세요!");
    const totalScore = finalScores.reduce((sum, f) => sum + (parseInt(f.score) || 0), 0);
    const expectedTotal = players.length === 4 ? 100000 : 105000;
    if (totalScore !== expectedTotal) return alert(`총합이 맞지 않습니다!\n(필요: ${expectedTotal}점 / 현재: ${totalScore}점)`);

    const scoresWithIndex = finalScores.map((f, index) => ({ score: parseInt(f.score), index }));
    scoresWithIndex.sort((a, b) => b.score !== a.score ? b.score - a.score : a.index - b.index);

    const calculatedResults = [...finalScores];
    scoresWithIndex.forEach((item, rank) => {
      let pt = 0;
      if (players.length === 4) pt = (item.score - 30000) / 1000 + [50, 10, -10, -30][rank];
      else pt = (item.score - 40000) / 1000 + [45, 0, -30][rank];
      calculatedResults[item.index] = { score: item.score, pt: parseFloat(pt.toFixed(1)) };
    });
    
    await setDoc(doc(db, 'games', selectedGameId.toString()), { ...currentGame, status: '종료', finalResults: calculatedResults });
    setIsEndGameModalOpen(false);
  };

  // ==========================================
  // 📊 통계 및 랭킹 데이터 처리 로직
  // ==========================================
  const [statsMainTab, setStatsMainTab] = useState('전체'); 
  const [statsSubTab, setStatsSubTab] = useState('플레이어'); 
  const [statsSearchQuery, setStatsSearchQuery] = useState(''); // 💡 통계 페이지 플레이어 검색

  const [rankingMainTab, setRankingMainTab] = useState('4인'); 
  const [rankingSortConfig, setRankingSortConfig] = useState({ key: 'totalUma', direction: 'desc' }); // 💡 랭킹 정렬
  const [playerStatTab, setPlayerStatTab] = useState('전체'); 
  const [selectedStatPlayerName, setSelectedStatPlayerName] = useState(null); 
  const [breakdownData, setBreakdownData] = useState(null); 

  const getFilteredGamesForStats = (typeTab) => {
    return games.filter(g => {
      if (g.status !== '종료') return false;
      if (typeTab !== '전체' && g.type !== typeTab) return false;
      if (selectedSeason !== 'all' && g.seasonId !== selectedSeason) return false;
      return true;
    });
  };

  const generatePlayerStats = (targetGames) => {
    const stats = {};
    targetGames.forEach(game => {
      const sorted = game.finalResults.map((r, i) => ({ ...r, player: game.players[i] })).sort((a, b) => b.score - a.score);
      sorted.forEach((res, rank) => {
        const p = res.player;
        if (!stats[p]) {
          stats[p] = { 
            name: p, gamesPlayed: 0, gamesPlayed4: 0, gamesPlayed3: 0, totalUma: 0, totalUma4: 0, totalUma3: 0, totalScore: 0, maxScore: -99999, minScore: 99999,
            ranks: [0,0,0,0], tobiCount: 0, roundsPlayed: 0, winCount: 0, dealInCount: 0, 
            tsumoCount: 0, ronCount: 0, riichiWinCount: 0, damaWinCount: 0, furoWinCount: 0,
            totalHan: 0, maxHonba: 0, waitTypes: {}, yakus: {},
            totalWinScore: 0, winScoreCount: 0, maxWinScore: 0, 
            totalDealInScore: 0, dealInScoreCount: 0, maxDealInScore: 0,
            chomboCount: 0, yakumanCount: 0,
            menzenTsumo: 0, menzenRon: 0, furoTsumo: 0, furoRon: 0
          };
        }
        stats[p].gamesPlayed += 1; 
        stats[p].totalUma += res.pt; 
        if (game.type === '4인') { stats[p].totalUma4 += res.pt; stats[p].gamesPlayed4 += 1; }
        if (game.type === '3인') { stats[p].totalUma3 += res.pt; stats[p].gamesPlayed3 += 1; }
        stats[p].totalScore += res.score; stats[p].ranks[rank] += 1;
        
        if (res.score > stats[p].maxScore) stats[p].maxScore = res.score;
        if (res.score < stats[p].minScore) stats[p].minScore = res.score;
        if (res.score < 0) stats[p].tobiCount += 1;
      });

      game.rounds.forEach(round => {
        game.players.forEach(p => { if (stats[p]) stats[p].roundsPlayed += 1; });
        if(round.type === '화료') {
          const winnerStat = stats[round.winner];
          
          // 💡 자동 계산 로직 적용 (본장 0 처리하여 순수 점수 추출)
          const dealerIndex = (round.roundNum - 1) % game.players.length;
          const isDealer = game.players.indexOf(round.winner) === dealerIndex;
          const isTsumo = round.winType === '쯔모';
          const { pureTotal } = getMahjongScore(round.han, round.fu, isDealer, isTsumo, 0, game.type === '3인');

          if(winnerStat) {
            winnerStat.winCount += 1; winnerStat.totalHan += round.han;
            if (round.honba > winnerStat.maxHonba) winnerStat.maxHonba = round.honba;
            
            const isMenzen = round.menzen === '멘젠';
            if (isTsumo) { winnerStat.tsumoCount += 1; isMenzen ? winnerStat.menzenTsumo++ : winnerStat.furoTsumo++; }
            if (round.winType === '론') { winnerStat.ronCount += 1; isMenzen ? winnerStat.menzenRon++ : winnerStat.furoRon++; }
            
            const isRiichi = round.selectedYaku?.includes('리치') || round.selectedYaku?.includes('더블리치');
            if (!isMenzen) winnerStat.furoWinCount += 1;
            else if (isRiichi) winnerStat.riichiWinCount += 1;
            else winnerStat.damaWinCount += 1;

            if (round.han >= 13 || round.selectedYaku?.some(y => yakuData['역만']?.includes(y) || yakuData['더블역만']?.includes(y))) winnerStat.yakumanCount += 1;

            winnerStat.waitTypes[round.waitType] = (winnerStat.waitTypes[round.waitType] || 0) + 1;
            round.selectedYaku?.forEach(yaku => { winnerStat.yakus[yaku] = (winnerStat.yakus[yaku] || 0) + 1; });
            
            if (pureTotal > 0) {
              winnerStat.totalWinScore += pureTotal;
              winnerStat.winScoreCount += 1;
              if (pureTotal > winnerStat.maxWinScore) winnerStat.maxWinScore = pureTotal; 
            }
          }
          if(round.winType === '론' && round.loser && stats[round.loser]) {
            stats[round.loser].dealInCount += 1;
            if (pureTotal > 0) {
              stats[round.loser].totalDealInScore += pureTotal;
              stats[round.loser].dealInScoreCount += 1;
              if (pureTotal > stats[round.loser].maxDealInScore) stats[round.loser].maxDealInScore = pureTotal; 
            }
          }
        } else if (round.type === '촌보') {
          if (round.chomboPlayer && stats[round.chomboPlayer]) stats[round.chomboPlayer].chomboCount += 1;
        }
      });
    });

    return Object.values(stats).map(s => {
      const avgRank = s.gamesPlayed > 0 ? ((s.ranks[0]*1 + s.ranks[1]*2 + s.ranks[2]*3 + s.ranks[3]*4) / s.gamesPlayed).toFixed(2) : 0;
      const rentaiCount = s.ranks[0] + s.ranks[1];
      return {
        ...s,
        // 💡 1. 화료/방총율 기준을 대국수(gamesPlayed)에서 라운드수(roundsPlayed)로 다시 복구
        winRate: s.roundsPlayed > 0 ? ((s.winCount / s.roundsPlayed) * 100).toFixed(1) : 0,
        dealInRate: s.roundsPlayed > 0 ? ((s.dealInCount / s.roundsPlayed) * 100).toFixed(1) : 0,
        avgHan: s.winCount > 0 ? (s.totalHan / s.winCount).toFixed(1) : 0,
        avgWinScore: s.winScoreCount > 0 ? Math.floor(s.totalWinScore / s.winScoreCount) : 0,
        avgUma: s.gamesPlayed > 0 ? (s.totalUma / s.gamesPlayed).toFixed(1) : 0,
        avgScore: s.gamesPlayed > 0 ? Math.floor(s.totalScore / s.gamesPlayed) : 0,
        avgDealInScore: s.dealInScoreCount > 0 ? Math.floor(s.totalDealInScore / s.dealInScoreCount) : 0,
        
        // 💡 2. 랭킹에 보여줄 등수와 비율 데이터 명시적 추가
        rank1Count: s.ranks[0],
        firstRate: s.gamesPlayed > 0 ? ((s.ranks[0] / s.gamesPlayed) * 100).toFixed(1) : 0,
        rank2Count: s.ranks[1],
        secondRate: s.gamesPlayed > 0 ? ((s.ranks[1] / s.gamesPlayed) * 100).toFixed(1) : 0,
        rank3Count: s.ranks[2],
        thirdRate: s.gamesPlayed > 0 ? ((s.ranks[2] / s.gamesPlayed) * 100).toFixed(1) : 0,
        rank4Count: s.ranks[3],
        fourthRate: s.gamesPlayed > 0 ? ((s.ranks[3] / s.gamesPlayed) * 100).toFixed(1) : 0,
        
        rentaiRate: s.gamesPlayed > 0 ? ((rentaiCount / s.gamesPlayed) * 100).toFixed(1) : 0,
        tobiRate: s.gamesPlayed > 0 ? ((s.tobiCount / s.gamesPlayed) * 100).toFixed(1) : 0,
        avgRank: avgRank,
        topYakus: Object.entries(s.yakus).sort((a,b) => b[1] - a[1]).slice(0, 5)
      };
    });
  };

  const statsGames = getFilteredGamesForStats(statsMainTab);
  // 💡 정렬 로직: 4인 우마 -> 4인 안 해본 사람은 맨 뒤로 -> 3인 우마 -> 이름순
  const playerStatsList = useMemo(() => {
    return generatePlayerStats(statsGames).sort((a, b) => {
      if (a.gamesPlayed4 > 0 && b.gamesPlayed4 === 0) return -1;
      if (a.gamesPlayed4 === 0 && b.gamesPlayed4 > 0) return 1;
      if (b.totalUma4 !== a.totalUma4) return b.totalUma4 - a.totalUma4;
      if (b.totalUma3 !== a.totalUma3) return b.totalUma3 - a.totalUma3;
      return a.name.localeCompare(b.name);
    });
  }, [statsGames]);
  // 💡 선택된 플레이어는 단순 이름 참조용 객체로 관리 (어차피 모달에서 데이터 자체 계산됨)
  const selectedStatPlayer = selectedStatPlayerName ? { name: selectedStatPlayerName } : null;

  const filteredPlayerStatsList = playerStatsList.filter(p => p.name.includes(statsSearchQuery));

  // 💡 세부 분포 모달 데이터 생성 (동점 순위 및 가나다 정렬 적용)
  const openBreakdown = (title, type, key) => {
    const rawData = playerStatsList.map(p => {
      let count = 0;
      if (type === 'yaku') count = p.yakus[key] || 0;
      else if (type === 'wait') count = p.waitTypes[key] || 0;
      else if (type === 'winType') count = p[key] || 0;
      return { name: p.name, count };
    }).filter(p => p.count > 0).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name); // 동점 시 이름 가나다순
    });

    let currentRank = 1;
    const rankedData = rawData.map((item, index, arr) => {
      if (index > 0 && item.count < arr[index - 1].count) currentRank = index + 1;
      return { ...item, rank: currentRank };
    });

    setBreakdownData({ title, data: rankedData });
  };

  // 💡 전체 역 통계 데이터 생성 (동점 순위 및 가나다 정렬 적용)
  const globalYakuStats = useMemo(() => {
    const yCounts = {};
    statsGames.forEach(g => g.rounds.forEach(r => { if(r.type === '화료') r.selectedYaku?.forEach(y => yCounts[y] = (yCounts[y] || 0) + 1); }));
    
    const sorted = Object.entries(yCounts).map(([yaku, count]) => ({ yaku, count })).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.yaku.localeCompare(b.yaku); // 동점 시 역 이름 가나다순
    });

    let currentRank = 1;
    return sorted.map((item, index, arr) => {
      if (index > 0 && item.count < arr[index - 1].count) currentRank = index + 1;
      return { ...item, rank: currentRank };
    });
  }, [statsGames]);

  const globalWinStats = useMemo(() => {
    const w = { menzenTsumo:0, menzenRon:0, furoTsumo:0, furoRon:0, riichi:0, dama:0, furoWin:0, wait: {}, winCount:0 };
    statsGames.forEach(g => g.rounds.forEach(r => {
      if(r.type === '화료') {
        w.winCount++;
        const isMenzen = r.menzen === '멘젠';
        if (r.winType === '쯔모') isMenzen ? w.menzenTsumo++ : w.furoTsumo++;
        if (r.winType === '론') isMenzen ? w.menzenRon++ : w.furoRon++;
        
        const isRiichi = r.selectedYaku?.includes('리치') || r.selectedYaku?.includes('더블리치');
        if (!isMenzen) w.furoWin++;
        else if (isRiichi) w.riichi++;
        else w.dama++;

        w.wait[r.waitType] = (w.wait[r.waitType] || 0) + 1;
      }
    }));
    return w;
  }, [statsGames]);

  const requestRankingSort = (key) => {
    let direction = 'desc';
    if (rankingSortConfig.key === key && rankingSortConfig.direction === 'desc') direction = 'asc';
    setRankingSortConfig({ key, direction });
  };

  const rankingList = useMemo(() => {
    const list = generatePlayerStats(getFilteredGamesForStats(rankingMainTab));
    const sorted = list.sort((a, b) => {
      let valA = a[rankingSortConfig.key];
      let valB = b[rankingSortConfig.key];
      
      if (['firstRate', 'secondRate', 'thirdRate', 'fourthRate', 'rentaiRate', 'tobiRate', 'avgRank', 'avgUma', 'totalUma', 'maxScore', 'minScore', 'gamesPlayed', 'avgScore', 'winCount', 'winRate', 'dealInCount', 'dealInRate', 'avgWinScore', 'maxWinScore', 'avgDealInScore', 'maxDealInScore', 'rank1Count', 'rank2Count', 'rank3Count', 'rank4Count'].includes(rankingSortConfig.key)) {
        valA = parseFloat(valA); valB = parseFloat(valB);
      }
      
      if (valA < valB) return rankingSortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return rankingSortConfig.direction === 'asc' ? 1 : -1;
      
      // 💡 동점 시 무조건 총 우마가 높은 순서로 정렬 (강력한 Tiebreaker)
      if (b.totalUma !== a.totalUma) return b.totalUma - a.totalUma;

      return a.name.localeCompare(b.name);
    });

    let currentRank = 1;
    return sorted.map((player, index, arr) => {
      if (index > 0) {
        const prev = arr[index - 1];
        let isTie = player[rankingSortConfig.key] === prev[rankingSortConfig.key];
        if (!isTie) currentRank = index + 1;
      }
      return { ...player, rank: currentRank };
    });
  }, [games, rankingMainTab, rankingSortConfig, selectedSeason]);


  if (isLoading) return <div className="h-screen w-full flex items-center justify-center bg-[#F5F5DC] text-[#2E7D32] font-bold">서버 연결 중...</div>;

  return (
    <div className="flex flex-col h-screen bg-[#F5F5DC] font-sans relative overflow-hidden text-[#1A1A1A]">
      
      <main className="flex-1 overflow-y-auto flex flex-col relative pb-24">
          
      <header className="bg-[#2E7D32] text-white p-4 pt-10 shadow-md z-20 shrink-0">
        <div className="flex items-center justify-between mb-3 min-h-[36px]">
          {activeNav === '기록' && selectedGameId !== null ? (
            <div className="flex items-center w-full">
              <button onClick={() => setSelectedGameId(null)} className="p-1 hover:bg-green-700 rounded-full transition-colors absolute left-4"><ChevronLeft size={28} /></button>
              <h1 className="text-xl font-bold tracking-tight w-full text-center pr-4">대국 상세 기록</h1>
            </div>
          ) : (
             <h1 className="text-xl font-bold tracking-tight">
               {activeNav === '기록' ? '리치마작 기록' : 
                activeNav === '통계' ? '마작 통계' : 
                activeNav === '랭킹' ? '플레이어 랭킹' : '업데이트 내역'}
             </h1>
          )}
          
          {selectedGameId === null && (
            <div className="flex items-center gap-1.5">
              {currentUser ? (
                <>
                  <span className="text-[10px] font-medium bg-green-800 px-2 py-1 rounded-lg">{currentUser.role === 'master' ? '👑' : currentUser.role === 'admin' ? '🛡️' : '♟️'} {currentUser.name}</span>
                  {isAdmin && <button onClick={() => setIsSeasonModalOpen(true)} className="p-1.5 bg-green-800 rounded-lg hover:bg-green-900 transition-colors"><CalendarPlus size={16} /></button>}
                  {isMaster && <button onClick={() => setIsMasterModalOpen(true)} className="p-1.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"><Users size={16} /></button>}
                  <button onClick={handleLogout} className="p-1.5 bg-green-800 rounded-lg text-yellow-300 hover:bg-green-900 transition-colors"><Unlock size={16} /></button>
                </>
              ) : (
                <button onClick={() => {setAuthMode('login'); setIsAuthModalOpen(true);}} className="p-1.5 bg-green-800 rounded-lg hover:bg-green-900 flex items-center gap-1 text-sm font-medium"><Lock size={14} /> <span className="text-[10px]">로그인/가입</span></button>
              )}
            </div>
          )}
        </div>
        {selectedGameId === null && (
          <div className="relative">
            <select value={selectedSeason} onChange={(e) => setSelectedSeason(e.target.value)} className="w-full bg-green-800 text-white text-sm font-bold py-2 px-3 rounded-xl appearance-none border border-green-700 focus:outline-none">
              <option value="all">전체 시즌</option>
              {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
      </header>

      {activeNav === '기록' && selectedGameId === null && (
        <div className="flex bg-white border-b border-gray-200 shadow-sm z-10 shrink-0">
          {['전체', '4인', '3인'].map(t => (
            <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-3 text-center font-bold flex justify-center items-center gap-1.5 border-b-2 ${activeTab === t ? 'border-[#2E7D32] text-[#2E7D32]' : 'border-transparent text-gray-500'}`}>
              {t} 게임 <span className={`text-[10px] px-2 py-0.5 rounded-full text-white ${activeTab === t ? 'bg-[#2E7D32]' : 'bg-gray-300'}`}>{t === '전체' ? games.length : games.filter(g=>g.type===t).length}</span>
            </button>
          ))}
        </div>
      )}

      {activeNav === '기록' && selectedGameId === null && (
        <div className="px-4 pt-4 pb-0 bg-[#F5F5DC] shrink-0 space-y-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search size={16} className="text-gray-400" /></div>
            <input type="text" placeholder="플레이어 이름 또는 날짜 검색..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-[#2E7D32] shadow-sm" />
          </div>
         {/* 💡 필터 버튼 UI 영역 */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {['전체', '역만', '촌보', '코멘트'].map(f => (
              <button 
                key={f} 
                onClick={() => setGameFilter(f)} 
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border shadow-sm ${
                  gameFilter === f 
                    ? 'bg-[#2E7D32] text-white border-[#2E7D32]' 
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {f === '역만' && '🔥 '}{f === '촌보' && '⚠️ '}{f === '코멘트' && '💬 '}{f}
              </button>
            ))}
          </div>
        </div>
      )}

        {/* ========================================= */}
        {/* 화면 1: 대국 기록 메인 리스트 */}
        {/* ========================================= */}
        {activeNav === '기록' && selectedGameId === null && (
          <div className="flex-1 flex flex-col p-4 space-y-4">
            {displayedGames.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center mt-20 text-gray-400 text-center">
                <Gamepad2 size={64} strokeWidth={1} className="mb-4 text-gray-300" />
                <h2 className="text-lg font-bold mb-2">검색된 대국 기록이 없습니다</h2>
                {canWrite ? <p className="text-xs">우측 하단 + 버튼으로 새 대국을 만드세요</p> : currentUser ? <p className="text-xs font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">쓰기 권한 승인 대기 중입니다 (마스터 문의)</p> : <p className="text-xs">우측 상단 로그인 후 기록을 추가할 수 있습니다</p>}
              </div>
            ) : (
              displayedGames.map(game => {
                const isGameYakuman = hasYakuman(game);
                const hasChomboGame = game.rounds.some(r => r.type === '촌보');
                
                const playerYakuman = (p) => game.rounds.some(r => r.type === '화료' && r.winner === p && (r.han >= 13 || r.selectedYaku?.some(y => yakuData['역만']?.includes(y) || yakuData['더블역만']?.includes(y))));
                const playerChombo = (p) => game.rounds.some(r => r.type === '촌보' && r.chomboPlayer === p);

                // 💡 카드 전체 배경 및 테두리 (조건 2, 3 반영)
                let cardClass = "bg-white border-gray-100";
                if (isGameYakuman && hasChomboGame) {
                  cardClass = "bg-gray-300 border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]";
                } else if (isGameYakuman) {
                  cardClass = "bg-white border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]";
                } else if (hasChomboGame) {
                  cardClass = "bg-gray-300 border border-gray-400";
                }

                return (
                  <div key={game.id} onClick={() => setSelectedGameId(game.id)} className={`p-4 rounded-[20px] shadow-sm relative cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98] border ${cardClass}`}>
                    {isGameYakuman && <span className="absolute -top-3 -right-2 bg-gradient-to-r from-red-500 to-yellow-500 text-white text-[10px] font-black px-2 py-1 rounded-full shadow-md animate-pulse">역만 대국🔥</span>}
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-medium text-gray-400">{game.date}</span>
                        <div className="flex items-center gap-1.5"><span className={`text-[10px] font-bold px-2 py-1 rounded ${game.status === '종료' ? 'text-gray-600 bg-gray-100' : 'text-[#2E7D32] bg-green-50'}`}>{game.rounds.length}국</span><span className={`text-[10px] font-bold px-2 py-1 rounded ${game.status === '종료' ? 'text-gray-500 bg-gray-200' : 'text-[#2E7D32] bg-green-50'}`}>{game.status}</span></div>
                    </div>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-bold text-base text-gray-800 truncate pr-4 tracking-tight">{game.players.join(' · ')}</h3>
                      {canWrite && <button onClick={(e) => handleDeleteGame(e, game.id)} className="text-red-300 hover:text-red-500 p-1"><Trash2 size={16} /></button>}
                    </div>
                    
                    <div className="grid gap-2 mt-2 grid-cols-2">
                    {game.players.map((p, i) => {
                      const isTobi = game.status === '종료' && game.finalResults && game.finalResults[i].score < 0;
                      const hasY = playerYakuman(p);
                      const hasC = playerChombo(p);
                      
                      // 💡 기본값 설정
                      let boxBg = 'bg-white';
                      let boxBorder = 'border border-gray-100';
                      let windBg = 'bg-[#2E7D32]'; // 기본 초록색
                      let nameColor = 'text-gray-800';

                      // 2. 역만과 촌보를 동시에 한 경우
                      if (hasY && hasC) {
                        boxBg = 'bg-white';
                        boxBorder = 'border-2 border-gray-600'; 
                        windBg = 'bg-red-600'; 
                        nameColor = 'text-gray-800';
                      }
                      // 3. 촌보만 한 경우
                      else if (hasC) {
                        boxBg = 'bg-white';
                        boxBorder = 'border-2 border-gray-600'; // 굵은 파란색 테두리
                        windBg = 'bg-gray-600'; // 바람 파란색
                        nameColor = 'text-gray-800';
                      }
                      // 4. 역만만 한 경우
                      else if (hasY) {
                        boxBg = 'bg-white';
                        boxBorder = 'border-2 border-red-500'; // 굵은 빨간색 테두리
                        windBg = 'bg-red-600'; // 바람 빨간색
                        nameColor = 'text-gray-800';
                      }

                      // 1. 토비(점수 음수)가 나면 최우선으로 회색 처리
                      if (isTobi) {
                        boxBg = 'bg-gray-100'; // 배경은 흰색 유지
                        nameColor = 'text-gray-400'; // 이름 회색
                      } 

                      return (
                        <div key={i} className={`flex items-center justify-between p-2 rounded-xl shadow-sm ${boxBg} ${boxBorder}`}>
                          <div className="flex items-center gap-1.5 overflow-hidden">
                            <div className={`${windBg} text-white w-6 h-6 min-w-[24px] rounded flex items-center justify-center font-bold text-xs shadow-inner transition-colors`}>
                              {['동','남','서','북'][i]}
                            </div>
                            <span className={`text-sm font-bold truncate ${nameColor}`}>{p}</span>
                          </div>
                          {game.status === '종료' && game.finalResults && (
                            <div className="flex flex-col items-end pr-1">
                              <span className={`text-sm font-black ${game.finalResults[i].pt > 0 ? 'text-[#2E7D32]' : game.finalResults[i].pt < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                                {game.finalResults[i].pt > 0 ? '+' : ''}{game.finalResults[i].pt}
                              </span>
                              <span className={`text-[10px] font-bold mt-0.5 ${isTobi ? 'text-gray-300' : 'text-gray-400'}`}>
                                {Number(game.finalResults[i].score).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  </div>
                );
              })
            )}
            
            {/* 💡 전체 탭 플로팅 메뉴형 추가 버튼 */}
            {canWrite && (
              <div className="fixed bottom-20 right-6 z-20 flex flex-col items-end">
                {activeTab === '전체' && showNewGameMenu && (
                  <div className="flex flex-col gap-2 mb-3 animate-in slide-in-from-bottom-2 fade-in zoom-in duration-200">
                    <button onClick={() => {setNewGameType('4인'); setIsNewGameModalOpen(true); setShowNewGameMenu(false);}} className="bg-white text-[#2E7D32] font-black text-sm px-5 py-3 rounded-full shadow-lg border border-gray-100 hover:bg-gray-50 active:scale-95 transition-all flex items-center gap-2">
                      <Users size={16}/> 4인 게임 시작
                    </button>
                    <button onClick={() => {setNewGameType('3인'); setIsNewGameModalOpen(true); setShowNewGameMenu(false);}} className="bg-white text-[#2E7D32] font-black text-sm px-5 py-3 rounded-full shadow-lg border border-gray-100 hover:bg-gray-50 active:scale-95 transition-all flex items-center gap-2">
                      <Users size={16}/> 3인 게임 시작
                    </button>
                  </div>
                )}
                <button 
                  onClick={() => {
                    if (activeTab === '전체') setShowNewGameMenu(!showNewGameMenu);
                    else { setNewGameType(activeTab); setIsNewGameModalOpen(true); }
                  }} 
                  className={`bg-[#2E7D32] text-white p-4 rounded-full shadow-lg hover:bg-green-800 active:scale-95 transition-transform ${showNewGameMenu ? 'rotate-45' : ''}`}
                >
                  <Plus size={28} strokeWidth={3} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========================================= */}
        {/* 화면 1-B: 대국 상세 화면 */}
        {/* ========================================= */}
        {activeNav === '기록' && selectedGameId !== null && currentGame && (
          <div className="flex-1 flex flex-col">
            <div className="bg-white border-b border-gray-200 grid grid-cols-4 divide-x divide-gray-100 text-center py-2.5 shadow-sm z-10 shrink-0">
              <div className="flex flex-col"><span className="text-lg font-black text-[#2E7D32]">{totalRecords}</span><span className="text-[9px] text-gray-500 font-bold">총 기록</span></div>
              <div className="flex flex-col"><span className="text-lg font-black text-[#2E7D32]">{tsumoCount}</span><span className="text-[9px] text-gray-500 font-bold">쯔모</span></div>
              <div className="flex flex-col"><span className="text-lg font-black text-orange-500">{ronCount}</span><span className="text-[9px] text-gray-500 font-bold">론</span></div>
              <div className="flex flex-col"><span className="text-lg font-black text-gray-500">{drawCount}</span><span className="text-[9px] text-gray-500 font-bold">유국</span></div>
            </div>

            <div className="p-4 pb-0">
              <div className="bg-[#2E7D32] bg-opacity-5 p-3 rounded-xl border border-green-100 flex justify-between items-center text-sm font-bold shadow-inner">
                {players.map((p, i) => (
                  <div key={i} className={`text-center flex-1 flex flex-col items-center ${i > 0 ? "border-l border-green-200 border-opacity-50" : ""}`}>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-[13px] mb-1.5 shadow-sm bg-[#2E7D32]`}>
                      {["동", "남", "서", "북"][i]}
                    </div>
                    <span className="block text-gray-800">{p}</span>
                  </div>
                ))}
              </div>
              {currentGame.status === '종료' && currentGame.finalResults && (
                <div className="bg-[#1e293b] text-white rounded-xl p-4 mt-4 relative shadow-lg animate-in fade-in">
                  {canWrite && <button onClick={handleOpenEndGame} className="absolute top-3 right-3 text-[10px] font-bold bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded flex items-center gap-1 transition-colors"><Edit size={10}/> 수정</button>}
                  <h3 className="font-bold text-base mb-3 flex items-center gap-2"><Trophy size={16} className="text-yellow-400"/> 대국 결과</h3>
                  <div className="space-y-1.5">{players.map((p, i) => (<div key={i} className="flex justify-between items-center py-1.5 border-b border-gray-700 last:border-0 text-sm"><span className="font-bold">{p}</span><div className="flex items-center gap-3 text-right"><span className="w-16 font-medium text-gray-300 text-xs">{Number(currentGame.finalResults[i].score).toLocaleString()}</span><span className={`w-12 font-black ${parseFloat(currentGame.finalResults[i].pt) > 0 ? 'text-green-400' : parseFloat(currentGame.finalResults[i].pt) < 0 ? 'text-red-400' : 'text-gray-400'}`}>{parseFloat(currentGame.finalResults[i].pt) > 0 ? '+' : ''}{currentGame.finalResults[i].pt}</span></div></div>))}</div>
                </div>
              )}
              {currentGame.status === '진행중' && canWrite && (
                <button onClick={handleOpenEndGame} className="w-full bg-[#1e293b] text-white font-bold py-3.5 rounded-xl mt-4 flex justify-center items-center gap-2 hover:bg-gray-800 transition-colors shadow-md text-sm"><Flag size={16} /> 대국 종료 및 점수 입력</button>
              )}
            </div>

            <div className="p-4 space-y-3">
              {records.length === 0 ? (
                <div className="text-center py-10 text-gray-400 font-bold"><p>우측 하단의 + 버튼을 눌러</p><p>첫 번째 국을 기록해주세요!</p></div>
              ) : (
                records.map(record => {
                  const isRoundYakuman = record.type === '화료' && (record.han >= 13 || record.selectedYaku?.some(y => yakuData['역만']?.includes(y) || yakuData['더블역만']?.includes(y)));
                  
                  // 💡 만관 이상 호칭 판별 (부수 만관 포함)
                  let rankText = '';
                  if (record.han >= 13) rankText = `헤아림 역만 (${record.han}판)`;
                  else if (record.han >= 11) rankText = `삼배만 (${record.han}판)`;
                  else if (record.han >= 8) rankText = `배만 (${record.han}판)`;
                  else if (record.han >= 6) rankText = `하네만 (${record.han}판)`;
                  else if (record.han >= 5) rankText = `만관 (${record.han}판)`;
                  else if ((record.han === 4 && record.fu >= 40) || (record.han === 3 && record.fu >= 70)) rankText = `만관 (${record.han}판 ${record.fu}부)`;
                  else rankText = `${record.han}판 ${record.fu}부`;

                  // 💡 화면에 보여줄 점수 자동 계산 (종료된 대국일 때만 계산 및 노출)
                  let displayScore = "";
                  if (record.type === '화료' && currentGame.status === '종료') {
                    const dealerIndex = (record.roundNum - 1) % currentGame.players.length;
                    const isDealer = currentGame.players.indexOf(record.winner) === dealerIndex;
                    const { display } = getMahjongScore(record.han, record.fu, isDealer, record.winType === '쯔모', record.honba, currentGame.type === '3인');
                    displayScore = display;
                  }

                  return (
                  <div key={record.id} className={`rounded-xl shadow-sm relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 ${isRoundYakuman ? 'border-2 border-red-500 bg-white shadow-[0_0_10px_rgba(239,68,68,0.2)]' : record.type === '촌보' ? 'bg-gray-200 border-gray-100]' : record.type === '유국' ? 'bg-gray-50 border border-gray-300' : 'bg-white border border-gray-100'}`}>
                    
                    {/* 상단 국 정보 헤더 */}
                    <div className={`px-3 py-2 border-b flex justify-between items-center ${isRoundYakuman ? 'bg-red-50 border-red-100' : record.type === '촌보' ? 'bg-gray-400 border-gray-500' : record.type === '유국' ? 'bg-gray-200 border-gray-300' : 'bg-gray-100 border-gray-200'}`}>
                      <span className={`font-bold text-sm ${record.type === '촌보' ? 'text-gray-800' : isRoundYakuman ? 'text-red-800' : 'text-gray-700'}`}>
                        {record.wind}{record.roundNum}국 {record.honba > 0 && `${record.honba}본장`}
                        {record.type === '유국' && ' (유국)'}
                        {record.type === '촌보' && ' (촌보)'}
                        {isRoundYakuman && ' - 역만 등장'}
                      </span>
                      {canWrite && (
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleEditRound(record)} className={`transition-colors ${record.type === '촌보' ? 'text-gray-800' : 'text-gray-400 hover:text-gray-500'}`}><Edit size={14} /></button>
                          <button onClick={() => handleDeleteRound(record.id)} className={`transition-colors ${record.type === '촌보' ? 'text-gray-800' : 'text-gray-400 hover:text-red-500'}`}><Trash2 size={14} /></button>
                        </div>
                      )}
                    </div>

                    <div className="p-3 pt-2.5">
                      {/* 💡 핵심: 화료(및 역만) 시 정보 표시 부분 */}
                      {record.type === '화료' ? (
                        <>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`font-bold text-[11px] ${record.winType === '쯔모' ? 'text-[#2E7D32]' : 'text-orange-500'}`}>{record.winType}</span>
                            <span className="font-bold text-sm text-gray-800">
                              {record.winner} 
                              {record.winType === '론' && <span className="text-gray-400 text-xs font-medium mx-1">→ {record.loser}</span>}
                            </span>
                            <span className="ml-auto font-black text-[#2E7D32] text-xs">{displayScore}</span>
                          </div>
                          
                          <div className="flex flex-wrap gap-1 mb-1.5">
                            <span className="bg-gray-100 text-gray-600 text-[9px] px-1.5 py-0.5 rounded font-bold">{record.waitType}</span>
                            <span className="bg-gray-100 text-gray-600 text-[9px] px-1.5 py-0.5 rounded font-bold">{record.menzen}</span>
                            {record.selectedYaku?.map(yaku => (
                              <span key={yaku} className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${isRoundYakuman ? 'bg-red-100 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-100'}`}>
                                {yaku} {record.menzen === '비멘젠' && targetFuroYaku.includes(yaku) && '(-1판)'}
                              </span>
                            ))}
                            {(record.dora + record.aka + record.ura + record.pei) > 0 && (
                              <span className="bg-amber-50 text-amber-600 text-[9px] px-1.5 py-0.5 rounded font-bold border border-amber-200">도라 {record.dora + record.aka + record.ura + record.pei}</span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-400 font-bold mt-1">{rankText}</div>
                        </>
                      ) : record.type === '유국' ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5"><ShieldAlert size={14} className="text-gray-500" /><span className="font-bold text-gray-800 text-sm">{record.abortiveType ? `도중유국 (${record.abortiveType})` : '황패유국'}</span></div>
                          {!record.abortiveType && (
                            <div className="text-[11px] font-bold text-gray-600 pl-5 space-y-0.5">
                              <p className="text-gray-500">텐파이: <span className="text-gray-800">{record.tenpaiPlayers.length > 0 ? record.tenpaiPlayers.join(', ') : '전원 노텐'}</span></p>
                              {record.nagashiMangan?.length > 0 && (
                                <p className="text-gray-500 mt-1">유국만관: {record.nagashiMangan.map(p => <span key={p} className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded ml-1">{p}</span>)}</p>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <AlertOctagon size={14} className="text-gray-800" />
                            <span className="font-bold text-gray-800 text-sm">{record.chomboPlayer} 촌보</span>
                          </div>
                        </div>
                      )}
                      
                      {record.comment && (
                        <div className={`mt-2 pt-2 border-t text-[10px] font-medium flex gap-1 ${record.type === '촌보' ? 'border-gray-800 border-opacity-20 text-gray-800' : 'border-gray-100 border-opacity-50 text-gray-500'}`}>
                          <MessageSquare size={12} className="mt-0.5" /> {record.comment}
                        </div>
                      )}
                    </div>
                  </div>
                );
                })
              )}
            </div>

            {/* 💡 종국한 경기도 canWrite 권한만 있으면 + 버튼이 노출되어 수정할 수 있게 변경됨 */}
            {canWrite && (
              <div className="fixed bottom-20 right-6 z-20">
                <button onClick={handleOpenNewRound} className="bg-[#2E7D32] text-white p-4 rounded-full shadow-lg hover:bg-green-800 active:scale-95 transition-transform"><Plus size={28} strokeWidth={3} /></button>
              </div>
            )}
          </div>
        )}

        {/* ========================================= */}
        {/* 화면 2: 📈 개인 통계 (Statistics) 페이지 */}
        {/* ========================================= */}
        {activeNav === '통계' && (
          <div className="flex-1 flex flex-col bg-[#F5F5DC]">
            <div className="bg-white border-b border-gray-200 z-10 shadow-sm shrink-0">
              <div className="flex text-sm">
                {['전체', '4인', '3인'].map(t => (
                  <button key={t} onClick={() => setStatsMainTab(t)} className={`flex-1 py-3 font-bold ${statsMainTab === t ? 'bg-[#2E7D32] text-white' : 'text-gray-500 bg-gray-50 border-b-2 border-gray-200 hover:bg-gray-100'}`}>{t} 게임</button>
                ))}
              </div>
              <div className="flex text-[13px] border-t border-gray-200">
                {['플레이어', '역', '화료'].map(t => (
                  <button key={t} onClick={() => setStatsSubTab(t)} className={`flex-1 py-2.5 font-bold ${statsSubTab === t ? 'text-[#2E7D32] border-b-2 border-[#2E7D32]' : 'text-gray-400'}`}>{t}</button>
                ))}
              </div>
            </div>

            <div className="p-4 pb-10">
              {statsSubTab === '플레이어' && (
                <div className="space-y-4">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search size={16} className="text-gray-400" /></div>
                    <input type="text" placeholder="플레이어 검색..." value={statsSearchQuery} onChange={(e) => setStatsSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-[#2E7D32]" />
                  </div>

                  {filteredPlayerStatsList.length === 0 ? (
                    <div className="text-center py-20 text-gray-400 font-bold">대국 기록이 없거나 검색 결과가 없습니다.</div>
                  ) : (
                    filteredPlayerStatsList.map(stat => (
                      <div key={stat.name} onClick={() => setSelectedStatPlayerName(stat.name)} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition-all active:scale-[0.98]">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                          <div>
                            <h3 className="font-bold text-xl text-gray-800">{stat.name}</h3>
                            <span className="text-xs text-gray-500 font-bold mt-1 inline-block">{stat.gamesPlayed}국 </span>
                          </div>
                          
                          {statsMainTab === '전체' ? (
                            <div className="flex gap-2">
                              <div className="bg-green-50 p-2 rounded-xl border border-green-100 text-center w-[72px] shrink-0 flex flex-col justify-center">
                                <span className="block text-[9px] text-gray-500 font-bold mb-0.5">4인 우마</span>
                                <span className={`text-sm font-black ${stat.totalUma4 > 0 ? 'text-[#2E7D32]' : stat.totalUma4 < 0 ? 'text-red-500' : 'text-gray-700'} truncate`}>{stat.totalUma4 > 0 ? '+' : ''}{stat.totalUma4.toFixed(1)}</span>
                              </div>
                              <div className="bg-blue-50 p-2 rounded-xl border border-blue-100 text-center w-[72px] shrink-0 flex flex-col justify-center">
                                <span className="block text-[9px] text-gray-500 font-bold mb-0.5">3인 우마</span>
                                <span className={`text-sm font-black ${stat.totalUma3 > 0 ? 'text-blue-600' : stat.totalUma3 < 0 ? 'text-red-500' : 'text-gray-700'} truncate`}>{stat.totalUma3 > 0 ? '+' : ''}{stat.totalUma3.toFixed(1)}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-green-50 p-3 rounded-xl border border-green-100 text-center min-w-[80px]">
                              <span className="block text-[10px] text-gray-500 font-bold mb-0.5">현재 우마</span>
                              <span className={`text-xl font-black ${stat.totalUma > 0 ? 'text-[#2E7D32]' : stat.totalUma < 0 ? 'text-red-500' : 'text-gray-700'}`}>{stat.totalUma > 0 ? '+' : ''}{stat.totalUma.toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                        {stat.topYakus.length > 0 && (
                          <div className="p-3 bg-gray-50">
                            <h4 className="text-[10px] font-bold text-gray-400 mb-2">자주 쓴 역 TOP 5</h4>
                            <div className="flex flex-wrap gap-1.5">
                              {stat.topYakus.map(([yaku, count]) => (
                                <span key={yaku} className="bg-white border border-gray-200 px-2 py-1 rounded text-[10px] font-bold text-gray-700 shadow-sm">{yaku} <span className="text-[#2E7D32] ml-0.5">{count}</span></span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {statsSubTab === '역' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                  <h3 className="font-bold text-lg text-gray-800 mb-4 border-b pb-2">역별 출현 횟수 (전체)</h3>
                  {globalYakuStats.length === 0 ? <p className="text-gray-400 text-sm text-center py-10">데이터가 없습니다.</p> : (
                    <div className="space-y-3">
                      {globalYakuStats.map((item) => {
                        const maxCount = globalYakuStats[0].count;
                        const percent = (item.count / maxCount) * 100;
                        const rankColor = item.rank === 1 ? 'bg-yellow-400' : item.rank === 2 ? 'bg-gray-400' : item.rank === 3 ? 'bg-amber-600' : 'bg-gray-200 text-gray-500';
                        return (
                          <div key={item.yaku} onClick={() => openBreakdown(`${item.yaku} 출현 분포`, 'yaku', item.yaku)} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-1.5 -mx-1.5 rounded transition-colors active:scale-[0.98]">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white ${rankColor}`}>{item.rank}</div>
                            <span className="w-24 text-sm font-bold text-gray-700 truncate">{item.yaku}</span>
                            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden relative"><div className="h-full bg-green-500 rounded-full" style={{ width: `${percent}%` }}></div></div>
                            <span className="w-8 text-right text-sm font-black text-[#2E7D32]">{item.count}회</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {statsSubTab === '화료' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                    <h3 className="font-bold text-lg text-gray-800 mb-4 border-b pb-2">전체 화료 비율</h3>
                    {globalWinStats.winCount === 0 ? <p className="text-xs text-gray-400">데이터 없음</p> : (
                      <div className="grid grid-cols-3 gap-2 bg-gray-50 p-3 rounded-lg text-center">
                        <div onClick={() => openBreakdown('리치 화료 분포', 'winType', 'riichiWinCount')} className="cursor-pointer hover:bg-gray-200 p-2 rounded transition-colors active:scale-[0.98]">
                          <span className="block text-[11px] font-bold text-red-600 mb-1">리치 화료율</span>
                          <span className="text-lg font-black text-gray-800">{((globalWinStats.riichi / globalWinStats.winCount) * 100).toFixed(1)}%</span>
                          <span className="block text-[10px] text-gray-500 mt-0.5">({globalWinStats.riichi}회)</span>
                        </div>
                        <div onClick={() => openBreakdown('다마텐 화료 분포', 'winType', 'damaWinCount')} className="cursor-pointer hover:bg-gray-200 p-2 rounded transition-colors active:scale-[0.98]">
                          <span className="block text-[11px] font-bold text-gray-600 mb-1">다마 화료율</span>
                          <span className="text-lg font-black text-gray-800">{((globalWinStats.dama / globalWinStats.winCount) * 100).toFixed(1)}%</span>
                          <span className="block text-[10px] text-gray-500 mt-0.5">({globalWinStats.dama}회)</span>
                        </div>
                        <div onClick={() => openBreakdown('후로 화료 분포', 'winType', 'furoWinCount')} className="cursor-pointer hover:bg-gray-200 p-2 rounded transition-colors active:scale-[0.98]">
                          <span className="block text-[11px] font-bold text-blue-600 mb-1">후로 화료율</span>
                          <span className="text-lg font-black text-gray-800">{((globalWinStats.furoWin / globalWinStats.winCount) * 100).toFixed(1)}%</span>
                          <span className="block text-[10px] text-gray-500 mt-0.5">({globalWinStats.furoWin}회)</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                    <h3 className="font-bold text-lg text-gray-800 mb-4 border-b pb-2">화료 형태별 비율</h3>
                    {globalWinStats.winCount === 0 ? <p className="text-xs text-gray-400">데이터 없음</p> : (
                      <div className="space-y-3">
                        {[
                          { label: '멘젠 쯔모', key: 'menzenTsumo', count: globalWinStats.menzenTsumo, color: 'bg-green-500' },
                          { label: '멘젠 론', key: 'menzenRon', count: globalWinStats.menzenRon, color: 'bg-[#2E7D32]' },
                          { label: '비멘젠 쯔모', key: 'furoTsumo', count: globalWinStats.furoTsumo, color: 'bg-blue-400' },
                          { label: '비멘젠 론', key: 'furoRon', count: globalWinStats.furoRon, color: 'bg-orange-400' }
                        ].map(w => {
                          const pct = ((w.count / globalWinStats.winCount) * 100).toFixed(1);
                          return (
                            <div key={w.label} onClick={() => openBreakdown(`${w.label} 분포`, 'winType', w.key)} className="cursor-pointer hover:bg-gray-50 p-2 -mx-2 rounded transition-colors active:scale-[0.98]">
                              <div className="flex justify-between text-xs font-bold text-gray-700 mb-1"><span>{w.label}</span><span>{w.count}회 ({pct}%)</span></div>
                              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${w.color}`} style={{width: `${pct}%`}}></div></div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                    <h3 className="font-bold text-lg text-gray-800 mb-4 border-b pb-2">대기 형태별 비율</h3>
                    <div className="space-y-3">
                      {['양면', '샤보', '간짱', '변짱', '단기', '특수대기'].map(w => {
                        const c = globalWinStats.wait[w] || 0;
                        const pct = globalWinStats.winCount > 0 ? ((c / globalWinStats.winCount) * 100).toFixed(1) : 0;
                        return (
                          <div key={w} onClick={() => openBreakdown(`${w} 대기 분포`, 'wait', w)} className="cursor-pointer hover:bg-gray-50 p-2 -mx-2 rounded transition-colors active:scale-[0.98]">
                            <div className="flex justify-between text-xs font-bold text-gray-700 mb-1"><span>{w}</span><span>{c}회 ({pct}%)</span></div>
                            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-gray-600" style={{width: `${pct}%`}}></div></div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================= */}
        {/* 화면 3: 🏆 랭킹 페이지 (확장 테이블) */}
        {/* ========================================= */}
        {activeNav === '랭킹' && (
          <div className="flex flex-col bg-[#F5F5DC]">
            <div className="flex bg-white border-b border-gray-200 shadow-sm z-10 shrink-0 text-sm">
              {['4인', '3인'].map(t => (
                <button key={t} onClick={() => setRankingMainTab(t)} className={`flex-1 py-3 font-bold ${rankingMainTab === t ? 'bg-[#2E7D32] text-white' : 'text-gray-500 bg-gray-50 border-b-2 border-gray-200 hover:bg-gray-100'}`}>{t} 순위</button>
              ))}
            </div>
            
            <div className="p-4 space-y-4">
              <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between shrink-0">
                <span className="text-xs font-bold text-gray-500 flex items-center gap-1"><BarChart2 size={14}/> 테이블 헤더를 터치하여 정렬하세요</span>
              </div>

              {rankingList.length === 0 ? (
                <div className="text-center py-20 text-gray-400 font-bold bg-white rounded-2xl shadow-sm border border-gray-100"><Trophy size={48} className="mx-auto mb-4 text-gray-300" /><p>아직 종료된 대국이 없어</p><p>순위를 매길 수 없습니다.</p></div>
              ) : (
                <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200 relative pb-2">
                  <table className="w-full min-w-max text-xs sm:text-sm text-center whitespace-nowrap table-auto border-collapse">
                    <thead className="bg-gray-100 font-bold text-gray-700 border-b border-gray-200">
                      <tr>
                        <th className="sticky left-0 bg-gray-100 z-30 p-3 border-b border-r border-gray-300 cursor-pointer hover:bg-gray-200" onClick={() => requestRankingSort('name')}><div className="flex items-center justify-center gap-1">작사 이름 <ArrowUpDown size={10}/></div></th>
                        <th className="p-3 border-b border-gray-300 cursor-pointer hover:bg-gray-200" onClick={() => requestRankingSort('gamesPlayed')}><div className="flex items-center justify-center gap-1">대국수 <ArrowUpDown size={10}/></div></th>
                        <th className="p-3 border-b border-gray-300 cursor-pointer hover:bg-gray-200" onClick={() => requestRankingSort('totalUma')}><div className="flex items-center justify-center gap-1">총 우마 <ArrowUpDown size={10}/></div></th>
                        <th className="p-3 border-b border-gray-300 cursor-pointer hover:bg-gray-200" onClick={() => requestRankingSort('avgUma')}><div className="flex items-center justify-center gap-1">평균 우마 <ArrowUpDown size={10}/></div></th>
                        <th className="p-3 border-b border-gray-300 cursor-pointer hover:bg-gray-200" onClick={() => requestRankingSort('rank1Count')}><div className="flex items-center justify-center gap-1">1등수 <ArrowUpDown size={10}/></div></th>
                        <th className="p-3 border-b border-gray-300 cursor-pointer hover:bg-gray-200" onClick={() => requestRankingSort('firstRate')}><div className="flex items-center justify-center gap-1">1등 비율 <ArrowUpDown size={10}/></div></th>
                        <th className="p-3 border-b border-gray-300 cursor-pointer hover:bg-gray-200" onClick={() => requestRankingSort('rank2Count')}><div className="flex items-center justify-center gap-1">2등수 <ArrowUpDown size={10}/></div></th>
                        <th className="p-3 border-b border-gray-300 cursor-pointer hover:bg-gray-200" onClick={() => requestRankingSort('secondRate')}><div className="flex items-center justify-center gap-1">2등 비율 <ArrowUpDown size={10}/></div></th>
                        <th className="p-3 border-b border-gray-300 cursor-pointer hover:bg-gray-200" onClick={() => requestRankingSort('rank3Count')}><div className="flex items-center justify-center gap-1">3등수 <ArrowUpDown size={10}/></div></th>
                        <th className="p-3 border-b border-gray-300 cursor-pointer hover:bg-gray-200" onClick={() => requestRankingSort('thirdRate')}><div className="flex items-center justify-center gap-1">3등 비율 <ArrowUpDown size={10}/></div></th>
                        
                        {rankingMainTab === '4인' && (
                          <>
                            <th className="p-3 border-b border-gray-300 cursor-pointer hover:bg-gray-200" onClick={() => requestRankingSort('rank4Count')}><div className="flex items-center justify-center gap-1">4등수 <ArrowUpDown size={10}/></div></th>
                            <th className="p-3 border-b border-gray-300 cursor-pointer hover:bg-gray-200" onClick={() => requestRankingSort('fourthRate')}><div className="flex items-center justify-center gap-1">4등 비율 <ArrowUpDown size={10}/></div></th>
                            <th className="p-3 border-b border-gray-300 cursor-pointer hover:bg-gray-200 text-blue-600" onClick={() => requestRankingSort('rentaiRate')}><div className="flex items-center justify-center gap-1">연대율 <ArrowUpDown size={10}/></div></th>
                          </>
                        )}
                        
                        <th className="p-3 border-b border-gray-300 cursor-pointer hover:bg-gray-200" onClick={() => requestRankingSort('tobiCount')}><div className="flex items-center justify-center gap-1">들통수 <ArrowUpDown size={10}/></div></th>
                        <th className="p-3 border-b border-gray-300 cursor-pointer hover:bg-gray-200" onClick={() => requestRankingSort('tobiRate')}><div className="flex items-center justify-center gap-1">들통율 <ArrowUpDown size={10}/></div></th>
                        <th className="p-3 border-b border-gray-300 cursor-pointer hover:bg-gray-200" onClick={() => requestRankingSort('avgScore')}><div className="flex items-center justify-center gap-1">평균 점수 <ArrowUpDown size={10}/></div></th>
                        <th className="p-3 border-b border-gray-300 cursor-pointer hover:bg-gray-200" onClick={() => requestRankingSort('maxScore')}><div className="flex items-center justify-center gap-1">최고 점수 <ArrowUpDown size={10}/></div></th>
                        <th className="p-3 border-b border-gray-300 cursor-pointer hover:bg-gray-200" onClick={() => requestRankingSort('minScore')}><div className="flex items-center justify-center gap-1">최소 점수 <ArrowUpDown size={10}/></div></th>
                        <th className="p-3 border-b border-gray-300 cursor-pointer hover:bg-gray-200" onClick={() => requestRankingSort('winCount')}><div className="flex items-center justify-center gap-1">화료수 <ArrowUpDown size={10}/></div></th>
                        <th className="p-3 border-b border-gray-300 cursor-pointer hover:bg-gray-200" onClick={() => requestRankingSort('winRate')}><div className="flex items-center justify-center gap-1">화료율 <ArrowUpDown size={10}/></div></th>
                        <th className="p-3 border-b border-gray-300 cursor-pointer hover:bg-gray-200" onClick={() => requestRankingSort('dealInCount')}><div className="flex items-center justify-center gap-1">방총수 <ArrowUpDown size={10}/></div></th>
                        <th className="p-3 border-b border-gray-300 cursor-pointer hover:bg-gray-200" onClick={() => requestRankingSort('dealInRate')}><div className="flex items-center justify-center gap-1">방총율 <ArrowUpDown size={10}/></div></th>
                        <th className="p-3 border-b border-gray-300 cursor-pointer hover:bg-gray-200" onClick={() => requestRankingSort('avgWinScore')}><div className="flex items-center justify-center gap-1">평균 타점 <ArrowUpDown size={10}/></div></th>
                        <th className="p-3 border-b border-gray-300 cursor-pointer hover:bg-gray-200" onClick={() => requestRankingSort('maxWinScore')}><div className="flex items-center justify-center gap-1">최고 타점 <ArrowUpDown size={10}/></div></th>
                        <th className="p-3 border-b border-gray-300 cursor-pointer hover:bg-gray-200" onClick={() => requestRankingSort('avgDealInScore')}><div className="flex items-center justify-center gap-1">평균 방총점 <ArrowUpDown size={10}/></div></th>
                        <th className="p-3 border-b border-gray-300 cursor-pointer hover:bg-gray-200" onClick={() => requestRankingSort('maxDealInScore')}><div className="flex items-center justify-center gap-1">최고 방총점 <ArrowUpDown size={10}/></div></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankingList.map((player, idx) => (
                        <tr key={player.name} className={`border-b border-gray-100 hover:bg-green-50 transition-colors ${idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}`}>
                          <td 
                            className="sticky left-0 p-3 border-r border-gray-200 font-bold text-gray-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] cursor-pointer hover:text-[#2E7D32] underline decoration-green-300 decoration-2 underline-offset-4" 
                            style={{ backgroundColor: idx % 2 === 1 ? '#f9fafb' : '#ffffff' }}
                            onClick={() => { setSelectedStatPlayerName(player.name); setPlayerStatTab(rankingMainTab); }}
                          >
                            {player.name}
                          </td>
                          <td className="p-3 text-gray-600">{player.gamesPlayed}국</td>
                          <td className={`p-3 font-black ${player.totalUma > 0 ? 'text-[#2E7D32]' : player.totalUma < 0 ? 'text-red-500' : ''}`}>{player.totalUma > 0 ? `+${player.totalUma.toFixed(1)}` : player.totalUma.toFixed(1)}</td>
                          <td className="p-3 text-gray-600 ">{player.avgUma > 0 ? `+${player.avgUma}` : player.avgUma}</td>
                          <td className="p-3 text-gray-600">{player.rank1Count}</td>
                          <td className="p-3 text-gray-600">{player.firstRate}%</td>
                          <td className="p-3 text-gray-600">{player.rank2Count}</td>
                          <td className="p-3 text-gray-600">{player.secondRate}%</td>
                          <td className="p-3 text-gray-600">{player.rank3Count}</td>
                          <td className="p-3 text-gray-600">{player.thirdRate}%</td>
                          
                          {rankingMainTab === '4인' && (
                            <>
                              <td className="p-3">{player.rank4Count}</td>
                              <td className="p-3 text-gray-600">{player.fourthRate}%</td>
                              <td className="p-3 text-blue-600">{player.rentaiRate}%</td>
                            </>
                          )}
                          
                          <td className="p-3">{player.tobiCount}</td>
                          <td className="p-3 font-medium text-gray-600">{player.tobiRate}%</td>
                          <td className="p-3 font-medium text-gray-600">{Number(player.avgScore).toLocaleString()}</td>
                          {/* 💡 값이 없을 때 '-' 대신 '0' 표기 */}
                          <td className="p-3 font-medium text-gray-600">{player.maxScore === -99999 ? 0 : Number(player.maxScore).toLocaleString()}</td>
                          <td className="p-3 font-medium text-gray-600">{player.minScore === 99999 ? 0 : Number(player.minScore).toLocaleString()}</td>
                          <td className="p-3 font-medium text-gray-600">{player.winCount}</td>
                          <td className="p-3 font-bold text-[#2E7D32]">{player.winRate}%</td>
                          <td className="p-3 font-medium text-gray-600">{player.dealInCount}</td>
                          <td className="p-3 font-bold text-orange-500">{player.dealInRate}%</td>
                          <td className="p-3 font-bold text-[#2E7D32]">{Number(player.avgWinScore).toLocaleString()}</td>
                          {/* 💡 값이 없을 때 '-' 대신 '0' 표기 */}
                          <td className="p-3 font-bold text-[#2E7D32]">{player.maxWinScore > 0 ? Number(player.maxWinScore).toLocaleString() : 0}</td>
                          <td className="p-3 font-bold text-orange-500">{Number(player.avgDealInScore).toLocaleString()}</td>
                          {/* 💡 값이 없을 때 '-' 대신 '0' 표기 */}
                          <td className="p-3 font-bold text-orange-500">{player.maxDealInScore > 0 ? Number(player.maxDealInScore).toLocaleString() : 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================= */}
        {/* 화면 5: ⚔️ 라이벌 (상대 전적) 페이지 */}
        {/* ========================================= */}
        {activeNav === '라이벌' && (() => {
          // 등록된 모든 플레이어 목록 추출
          const uniquePlayers = Array.from(new Set(games.flatMap(g => g.players))).sort();
          
          // 두 플레이어가 함께한 종료된 대국 필터링
          const rivalGames = games.filter(g => 
            g.status === '종료' && 
            g.players.includes(rival1) && 
            g.players.includes(rival2) && 
            rival1 !== rival2 &&
            (selectedSeason === 'all' || g.seasonId === selectedSeason) // 👈 바로 이 줄이 추가되었습니다!
          );
          
          let p1Wins = 0, p2Wins = 0;
          let p1RonP2 = 0, p2RonP1 = 0;
          let p1RonP2Max = 0, p1RonP2Min = 99999;
          let p2RonP1Max = 0, p2RonP1Min = 99999;

          if (rival1 && rival2 && rivalGames.length > 0) {
            rivalGames.forEach(g => {
              const p1Idx = g.players.indexOf(rival1);
              const p2Idx = g.players.indexOf(rival2);
              
              // 1. 순위 우위 비교
              if (g.finalResults) {
                const p1Score = Number(g.finalResults[p1Idx].score);
                const p2Score = Number(g.finalResults[p2Idx].score);
                if (p1Score > p2Score) p1Wins++;
                else if (p2Score > p1Score) p2Wins++;
              }
              
              // 2. 직접 방총 (서로 쏘인 횟수 및 최고/최저 점수 계산)
              g.rounds.forEach(r => {
                if (r.type === '화료' && r.winType === '론') {
                  const dealerIndex = (r.roundNum - 1) % g.players.length;
                  const isDealer = g.players.indexOf(r.winner) === dealerIndex;
                  
                  // 💡 순수 타점 계산 (본장 제외)
                  const { pureTotal } = getMahjongScore(r.han, r.fu, isDealer, false, 0, g.type === '3인');

                  if (r.winner === rival1 && r.loser === rival2) {
                    p1RonP2++;
                    if (pureTotal > p1RonP2Max) p1RonP2Max = pureTotal;
                    if (pureTotal < p1RonP2Min) p1RonP2Min = pureTotal;
                  }
                  if (r.winner === rival2 && r.loser === rival1) {
                    p2RonP1++;
                    if (pureTotal > p2RonP1Max) p2RonP1Max = pureTotal;
                    if (pureTotal < p2RonP1Min) p2RonP1Min = pureTotal;
                  }
                }
              });
            });
          }

          return (
            <div className="flex-1 flex flex-col bg-[#F5F5DC] p-4 space-y-4">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                <h3 className="font-black text-gray-800 text-lg flex items-center justify-center gap-2 mb-4"><Swords size={20}/> 상대 전적 검색</h3>
                <div className="flex items-center justify-between gap-3">
                  <select value={rival1} onChange={e => setRival1(e.target.value)} className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-center text-sm focus:outline-none focus:border-[#2E7D32]">
                    <option value="">플레이어 1</option>
                    {uniquePlayers.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <span className="font-black text-red-500 text-sm">VS</span>
                  <select value={rival2} onChange={e => setRival2(e.target.value)} className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-center text-sm focus:outline-none focus:border-blue-600">
                    <option value="">플레이어 2</option>
                    {uniquePlayers.map(p => <option key={p} value={p} disabled={p === rival1}>{p}</option>)}
                  </select>
                </div>
              </div>

              {!rival1 || !rival2 ? (
                <div className="flex-1 flex items-center justify-center text-gray-400 font-bold text-sm">두 명의 플레이어를 선택해주세요.</div>
              ) : rivalGames.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-gray-400 font-bold text-sm">함께 대국한 기록이 없습니다.</div>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                  {/* 동탁 우위 기록 */}
                  <div className="bg-[#1e293b] text-white p-4 rounded-2xl shadow-lg flex justify-center items-center gap-6">
                    <div className="text-center flex-1"><span className="block text-2xl font-black">{p1Wins}승</span><span className="text-[10px] text-gray-400">{rival1} 우위</span></div>
                    <div className="flex flex-col items-center"><span className="text-xs font-bold text-gray-400 bg-gray-800 px-3 py-1 rounded-full">총 {rivalGames.length}국 동탁</span></div>
                    <div className="text-center flex-1"><span className="block text-2xl font-black">{p2Wins}승</span><span className="text-[10px] text-gray-400">{rival2} 우위</span></div>
                  </div>

                  {/* 💡 직접 방총 기록 (최고/최저 타점 포함) */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-3 bg-gray-50 border-b border-gray-100 text-center font-bold text-sm text-gray-700">🩸 직접 타격 (방총)</div>
                    <div className="flex p-4 items-center justify-between">
                      
                      {/* Player 1이 Player 2를 쏘았을 때 */}
                      <div className="text-center w-[45%]">
                        <span className="block text-[11px] font-bold text-gray-600 mb-2 bg-gray-100 py-1.5 rounded-lg border border-gray-200">
                          {rival1} <span className="text-black-400">→</span> {rival2}
                        </span>
                        <span className="text-2xl font-black text-gray-800">{p1RonP2}회</span>
                        <div className="mt-3 space-y-1 bg-gray-50 p-2 rounded-lg border border-gray-100">
                          <div className="text-[10px] text-gray-500 flex justify-between px-1"><span className="font-bold">최고 타점</span><span className="font-black text-[#2E7D32]">{p1RonP2Max > 0 ? p1RonP2Max.toLocaleString() : 0}점</span></div>
                          <div className="text-[10px] text-gray-500 flex justify-between px-1"><span className="font-bold">최저 타점</span><span className="font-black text-[#2E7D32]">{p1RonP2Min !== 99999 ? p1RonP2Min.toLocaleString() : 0}점</span></div>
                        </div>
                      </div>

                      <div className="w-[10%] text-center text-gray-300 flex justify-center"><Swords size={24} strokeWidth={1.5}/></div>
                      
                      {/* Player 2가 Player 1을 쏘았을 때 */}
                      <div className="text-center w-[45%]">
                        <span className="block text-[11px] font-bold text-gray-600 mb-2 bg-gray-100 py-1.5 rounded-lg border border-gray-200">
                          {rival2} <span className="text-black-500">→</span> {rival1}
                        </span>
                        <span className="text-2xl font-black text-gray-800">{p2RonP1}회</span>
                        <div className="mt-3 space-y-1 bg-gray-50 p-2 rounded-lg border border-gray-100">
                          <div className="text-[10px] text-gray-500 flex justify-between px-1"><span className="font-bold">최고 타점</span><span className="font-black text-blue-600">{p2RonP1Max > 0 ? p2RonP1Max.toLocaleString() : 0}점</span></div>
                          <div className="text-[10px] text-gray-500 flex justify-between px-1"><span className="font-bold">최저 타점</span><span className="font-black text-blue-600">{p2RonP1Min !== 99999 ? p2RonP1Min.toLocaleString() : 0}점</span></div>
                        </div>
                      </div>

                    </div>
                  </div>
                  
                </div>
              )}
            </div>
          );
        })()}

        {/* ========================================= */}
        {/* 화면 4: 📢 업데이트 내역 페이지 */}
        {/* ========================================= */}
        {activeNav === '업데이트' && (
          <div className="flex-1 flex flex-col p-4 space-y-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                <span className="font-black text-[#2E7D32] text-xl">v1.0.2</span>
                <span className="text-sm font-bold text-gray-400">2026/03/06</span>
              </div>
              <ul className="text-sm font-bold text-gray-700 space-y-2 pl-2 list-disc list-inside">
                <li>라이벌 페이지를 신설하였습니다.</li>
                <li>개인 통계 페이지에서 화료 및 방총의 상대를 볼 수 있도록 개선하였습니다.</li>
                <li>개인 통계 페이지에 대국 스타일 스탯을 추가하였습니다.</li>
              </ul>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                <span className="font-black text-[#2E7D32] text-xl">v1.0.1</span>
                <span className="text-sm font-bold text-gray-400">2026/03/06</span>
              </div>
              <ul className="text-sm font-bold text-gray-700 space-y-2 pl-2 list-disc list-inside">
                <li>모바일 환경에서 최종점수가 음수인 경우 입력되지 않는 현상을 수정하였습니다.</li>
                <li>대국이 종료된 후 각 국의 점수를 표시하는 기능을 추가하였습니다.</li>
                <li>방총자 선택 방식을 더블클릭에서 길게 누르기로 변경하였습니다.</li>
                <li>비멘젠으로 화료할 경우, 멘젠 한정 역은 비활성화되는 기능을 추가하였습니다.</li>
              </ul>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                <span className="font-black text-[#2E7D32] text-xl">v1.0.0</span>
                <span className="text-sm font-bold text-gray-400">2026/03/05</span>
              </div>
              <ul className="text-sm font-bold text-gray-700 space-y-2 pl-2 list-disc list-inside">
                <li>리치 마작 기록 페이지 오픈</li>
              </ul>
            </div>
          </div>
        )}
      </main>

      {/* 💡 세부 분포 모달 (역, 대기, 화료형태 클릭 시) */}
      {breakdownData && (
        <div className="absolute inset-0 bg-black bg-opacity-60 z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh]">
            <div className="bg-[#1e293b] p-4 flex justify-between items-center text-white">
              <h3 className="font-bold text-lg">{breakdownData.title}</h3>
              <button onClick={() => setBreakdownData(null)} className="p-1 hover:bg-gray-700 rounded-full"><X size={20}/></button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3">
              {breakdownData.data.length === 0 ? (
                <p className="text-center text-gray-400 py-4 font-bold text-sm">기록된 데이터가 없습니다.</p>
              ) : (
                breakdownData.data.map((item) => {
                  const maxCount = breakdownData.data[0].count;
                  const pct = (item.count / maxCount) * 100;
                  const rankColor = item.rank === 1 ? 'bg-yellow-400' : item.rank === 2 ? 'bg-gray-400' : item.rank === 3 ? 'bg-amber-600' : 'bg-gray-200 text-gray-500';
                  return (
                    <div key={item.name} className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white ${rankColor}`}>{item.rank}</div>
                      <span className="w-20 text-sm font-bold text-gray-700 truncate">{item.name}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#2E7D32]" style={{ width: `${pct}%` }}></div>
                      </div>
                      <span className="w-8 text-right text-sm font-black text-[#2E7D32]">{item.count}회</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* 개인 통계 상세 모달 (Player Detail) */}
      {/* ========================================= */}
      {selectedStatPlayer && (
        <div className="absolute inset-0 bg-black bg-opacity-70 z-[90] flex flex-col justify-end animate-in fade-in">
          {(() => {
            const modalGames = games.filter(g => 
              g.status === '종료' && 
              g.players.includes(selectedStatPlayer.name) && 
              (playerStatTab === '전체' || g.type === playerStatTab) &&
              (selectedSeason === 'all' || g.seasonId === selectedSeason)
            );

            let playCount = 0, tScore = 0, tUma = 0, tRank = 0, rCount = 0;
            let tUma4 = 0, tUma3 = 0;
            let ranks = [0, 0, 0, 0];
            let wCount = 0, wScore = 0, wScoreCount = 0, dCount = 0, dScore = 0, dScoreCount = 0, mHonba = 0;
            let maxScore = -99999, minScore = 99999, maxWinScore = 0, maxDealInScore = 0;
            let tobiCount = 0, yakumanCount = 0, chomboCount = 0;
            let yakus = {};
            let waitTypes = {};
            let menzenTsumo = 0, menzenRon = 0, furoTsumo = 0, furoRon = 0;
            let riichiWinCount = 0, damaWinCount = 0, furoWinCount = 0;

            modalGames.forEach(g => {
                const pIdx = g.players.indexOf(selectedStatPlayer.name);
                if(g.finalResults && g.finalResults[pIdx]) {
                    const sortedResults = g.finalResults.map((r, i) => ({ score: Number(r.score), originalIndex: i })).sort((a, b) => b.score - a.score);
                    const myRankIndex = sortedResults.findIndex(r => r.originalIndex === pIdx);
                    
                    const finalScore = Number(g.finalResults[pIdx].score);
                    const finalPt = Number(g.finalResults[pIdx].pt);

                    tScore += finalScore;
                    tUma += finalPt;
                    if (g.type === '4인') tUma4 += finalPt;
                    if (g.type === '3인') tUma3 += finalPt;
                    tRank += (myRankIndex + 1);
                    ranks[myRankIndex] += 1;
                    playCount++;
                    
                    if (finalScore > maxScore) maxScore = finalScore;
                    if (finalScore < minScore) minScore = finalScore;
                    if (finalScore < 0) tobiCount++;
                }
                g.rounds.forEach(r => {
                    rCount++; 
                    if(r.type === '촌보' && r.chomboPlayer === selectedStatPlayer.name) chomboCount++;
                    if(r.type === '화료' && r.winner === selectedStatPlayer.name) {
                        wCount++;
                        
                        const dealerIndex = (r.roundNum - 1) % g.players.length;
                        const isDealer = g.players.indexOf(r.winner) === dealerIndex;
                        const isTsumo = r.winType === '쯔모';
                        const { pureTotal } = getMahjongScore(r.han, r.fu, isDealer, isTsumo, 0, g.type === '3인');

                        if (pureTotal > 0) { 
                          wScore += pureTotal; wScoreCount++; 
                          if (pureTotal > maxWinScore) maxWinScore = pureTotal; 
                        }
                        if(r.honba > mHonba) mHonba = r.honba;
                        
                        if (r.selectedYaku && r.selectedYaku.some(y => yakuData['역만']?.includes(y) || yakuData['더블역만']?.includes(y))) yakumanCount++;

                        if (r.selectedYaku) {
                            r.selectedYaku.forEach(y => {
                                yakus[y] = (yakus[y] || 0) + 1;
                                if (y === '리치' || y === '더블리치') riichiWinCount++;
                            });
                        }
                        
                        if (r.waitType) waitTypes[r.waitType] = (waitTypes[r.waitType] || 0) + 1;

                        const isMenzen = r.menzen === '멘젠';
                        if (isMenzen && isTsumo) menzenTsumo++;
                        if (isMenzen && r.winType === '론') menzenRon++;
                        if (!isMenzen && isTsumo) furoTsumo++;
                        if (!isMenzen && r.winType === '론') furoRon++;
                        
                        if (!isMenzen) furoWinCount++;
                        if (isMenzen && r.selectedYaku && !r.selectedYaku.includes('리치') && !r.selectedYaku.includes('더블리치')) damaWinCount++;
                    }
                    if(r.type === '화료' && r.winType === '론' && r.loser === selectedStatPlayer.name) {
                        dCount++;
                        const dealerIndex = (r.roundNum - 1) % g.players.length;
                        const isDealer = g.players.indexOf(r.winner) === dealerIndex;
                        const { pureTotal } = getMahjongScore(r.han, r.fu, isDealer, false, 0, g.type === '3인');
                        if(pureTotal > 0) { 
                          dScore += pureTotal; dScoreCount++; 
                          if (pureTotal > maxDealInScore) maxDealInScore = pureTotal; 
                        }
                    }
                });
            });

            const rentaiCount = ranks[0] + ranks[1];

            const mStat = {
                gamesPlayed: playCount, totalUma: tUma, totalUma4: tUma4, totalUma3: tUma3, winCount: wCount, dealInCount: dCount, 
                yakumanCount, chomboCount, ranks, tobiCount, rentaiCount,
                tobiRate: playCount > 0 ? ((tobiCount / playCount) * 100).toFixed(1) : 0,
                rentaiRate: playCount > 0 ? (((ranks[0] + ranks[1]) / playCount) * 100).toFixed(1) : 0,
                winRate: rCount > 0 ? ((wCount / rCount) * 100).toFixed(1) : 0, 
                dealInRate: rCount > 0 ? ((dCount / rCount) * 100).toFixed(1) : 0, 
                maxScore, minScore, maxWinScore, maxDealInScore, 
                avgScore: playCount > 0 ? Math.floor(tScore / playCount) : 0,
                avgWinScore: wScoreCount > 0 ? Math.floor(wScore / wScoreCount) : 0,
                avgUma: playCount > 0 ? (tUma / playCount).toFixed(1) : 0,
                maxHonba: mHonba, avgDealInScore: dScoreCount > 0 ? Math.floor(dScore / dScoreCount) : 0,
                yakus, riichiWinCount, damaWinCount, furoWinCount, menzenTsumo, menzenRon, furoTsumo, furoRon, waitTypes
            };

            // ---------------------------------------------------------
            // 💡 육각형 레이더 차트용 스탯 계산 (All-Time / 중복 변수명 수정)
            // ---------------------------------------------------------
            const rtAllGames = games.filter(g => g.status === '종료' && g.players.includes(selectedStatPlayer.name));
            let rtTotalRounds = 0, rtTotalWins = 0, rtTotalDealIns = 0, rtTotalWinScore = 0;
            let rtFuroWins = 0, rtRyanmenWins = 0, rtLuckPoints = 0, rtGames4 = 0, rtRentai4 = 0;

            rtAllGames.forEach(g => {
              const pIdx = g.players.indexOf(selectedStatPlayer.name);
              
              // [안정] 4마만 계산 (전체 시즌)
              if (g.type === '4인') {
                rtGames4++;
                const sorted = [...g.finalResults].sort((a,b) => b.score - a.score);
                const myRank = sorted.findIndex(s => s.score === g.finalResults[pIdx].score) + 1;
                if (myRank <= 2) rtRentai4++;
              }

              g.rounds.forEach(r => {
                rtTotalRounds++; // 참전 라운드
                if (r.type === '화료' && r.winner === selectedStatPlayer.name) {
                  rtTotalWins++;
                  // [화력] 평균 타점 (본장 제외)
                  const dealerIdx = (r.roundNum - 1) % g.players.length;
                  const isD = g.players.indexOf(r.winner) === dealerIdx;
                  const { pureTotal } = getMahjongScore(r.han, r.fu, isD, r.winType === '쯔모', 0, g.type === '3인');
                  rtTotalWinScore += pureTotal;

                  // [유연성] 비멘젠 화료
                  if (r.menzen === '비멘젠') rtFuroWins++;
                  // [조패] 양면 대기 화료
                  if (r.waitType === '양면') rtRyanmenWins++;
                  // [행운] 일발, 해저로월, 영상개화, 뒷도라 (하저로어 제외)
                  if (r.selectedYaku?.includes('리치') || r.selectedYaku?.includes('더블리치')) {
                    if (r.selectedYaku?.includes('일발')) rtLuckPoints++;
                  }
                  if (r.selectedYaku?.includes('해저로월')) rtLuckPoints++;
                  if (r.selectedYaku?.includes('영상개화')) rtLuckPoints++;
                  if (r.ura > 0) rtLuckPoints++; 
                }
                // [수비] 방총 횟수
                if (r.type === '화료' && r.winType === '론' && r.loser === selectedStatPlayer.name) rtTotalDealIns++;
              });
            });

            // 정규화 함수
            const rtNorm = (v, min, max) => Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));

            const scoreFire = rtTotalWins > 0 ? rtNorm(rtTotalWinScore / rtTotalWins, 3000, 10000) : 0;
            const scoreDef = rtTotalRounds > 0 ? rtNorm(25 - (rtTotalDealIns / rtTotalRounds * 100), 25 - 25, 25 - 10) : 0;
            const scoreStab = rtGames4 > 0 ? rtNorm(rtRentai4 / rtGames4 * 100, 30, 60) : 0;
            const scoreFlex = rtTotalWins > 0 ? rtNorm(rtFuroWins / rtTotalWins * 100, 10, 50) : 0;
            const scoreLuck = rtTotalWins > 0 ? rtNorm(rtLuckPoints / rtTotalWins, 0.1, 0.5) : 0;
            const scoreEffi = rtTotalWins > 0 ? rtNorm(rtRyanmenWins / rtTotalWins * 100, 25, 65) : 0;

            const rtRadarData = [
              { label: '화력', score: scoreFire, desc: '평균 타점 기반\n(평균-3000)/7000' },
              { label: '수비', score: scoreDef, desc: '방총률 역산\n(25-방총률)/15' },
              { label: '안정', score: scoreStab, desc: '4인 연대율 기반\n(연대율-30)/30' },
              { label: '유연성', score: scoreFlex, desc: '비멘젠 화료 비중\n(후로율-10)/40' },
              { label: '행운', score: scoreLuck, desc: '일발/해저/영상/뒷도라 빈도\n(행운지수-0.1)/0.4' },
              { label: '조패', score: scoreEffi, desc: '양면 대기 화료 비중\n(양면화료율-25)/40' },
            ];

            const rtCenterX = 100, rtCenterY = 100, rtRadius = 70;
            const rtGetPt = (s, i) => {
              const angle = (Math.PI * 2) / 6 * i - (Math.PI / 2);
              const r = (s / 100) * rtRadius;
              return `${rtCenterX + r * Math.cos(angle)},${rtCenterY + r * Math.sin(angle)}`;
            };
            const rtPolyPts = rtRadarData.map((d, i) => rtGetPt(d.score, i)).join(' ');

            // 💡 1. 화료 상세 분석 함수 (시즌/인원 필터 자동 적용)
            const handleWinBreakdown = () => {
              const stats = { '쯔모': 0 };
              modalGames.forEach(g => g.rounds.forEach(r => {
                if (r.type === '화료' && r.winner === selectedStatPlayer.name) {
                  if (r.winType === '쯔모') stats['쯔모']++;
                  else if (r.loser) stats[r.loser] = (stats[r.loser] || 0) + 1;
                }
              }));
              
              const rawData = Object.entries(stats).map(([name, count]) => ({ name, count })).filter(d => d.count > 0).sort((a,b) => {
                if (b.count !== a.count) return b.count - a.count;
                return a.name.localeCompare(b.name);
              });
              
              let currentRank = 1;
              const rankedData = rawData.map((item, index, arr) => {
                if (index > 0 && item.count < arr[index - 1].count) currentRank = index + 1;
                return { ...item, rank: currentRank };
              });

              let filterText = playerStatTab === '전체' ? '전체 마작' : playerStatTab;
              let seasonText = selectedSeason === 'all' ? '전체 시즌' : seasons.find(s => s.id === selectedSeason)?.name || '';
              setBreakdownData({ title: `${selectedStatPlayer.name}의 화료 대상 (${seasonText}, ${filterText})`, data: rankedData });
            };

            // 💡 2. 방총 상세 분석 함수 (시즌/인원 필터 자동 적용)
            const handleDealInBreakdown = () => {
              const stats = {};
              modalGames.forEach(g => g.rounds.forEach(r => {
                if (r.type === '화료' && r.winType === '론' && r.loser === selectedStatPlayer.name) {
                  stats[r.winner] = (stats[r.winner] || 0) + 1;
                }
              }));
              
              const rawData = Object.entries(stats).map(([name, count]) => ({ name, count })).filter(d => d.count > 0).sort((a,b) => {
                if (b.count !== a.count) return b.count - a.count;
                return a.name.localeCompare(b.name);
              });
              
              let currentRank = 1;
              const rankedData = rawData.map((item, index, arr) => {
                if (index > 0 && item.count < arr[index - 1].count) currentRank = index + 1;
                return { ...item, rank: currentRank };
              });

              let filterText = playerStatTab === '전체' ? '전체 마작' : playerStatTab;
              let seasonText = selectedSeason === 'all' ? '전체 시즌' : seasons.find(s => s.id === selectedSeason)?.name || '';
              setBreakdownData({ title: `${selectedStatPlayer.name}의 방총 대상 (${seasonText}, ${filterText})`, data: rankedData });
            };

            // 💡 3. 최근 8개 대국 누적 우마 차트 데이터 가공
            // 전체 대국을 과거 -> 최신(시간순)으로 정렬
            const chronologicalGames = [...modalGames].filter(g => g.finalResults).reverse();
            
            // 누적 우마 계산
            let currentTotalUma = 0;
            const cumulativeGames = chronologicalGames.map(g => {
              const pIdx = g.players.indexOf(selectedStatPlayer.name);
              const pt = Number(g.finalResults[pIdx].pt);
              currentTotalUma += pt;
              return { 
                id: g.id, 
                date: g.date, 
                pt: parseFloat(currentTotalUma.toFixed(1)), // 누적 우마
                gamePt: pt // 해당 판의 우마
              };
            });

            // 그 중 최근 8개만 추출
            const recentGames = cumulativeGames.slice(-8);

            const chartWidth = 320;
            const chartHeight = 150;
            const padX = 25;
            const padY = 35; // 라벨이 잘리지 않도록 여백 확보
            const innerW = chartWidth - padX * 2;
            const innerH = chartHeight - padY * 2;

            const pts = recentGames.map(g => g.pt);
            let maxPt = pts.length > 0 ? Math.max(...pts) : 0;
            let minPt = pts.length > 0 ? Math.min(...pts) : 0;
            
            // 그래프 상하 여백 확보
            if (maxPt === minPt) { 
              maxPt += 10; minPt -= 10; 
            } else {
              const diff = maxPt - minPt;
              maxPt += diff * 0.2; 
              minPt -= diff * 0.2;
            }
            const ptRange = maxPt - minPt;

            const getX = (index) => recentGames.length === 1 ? chartWidth / 2 : padX + (index * (innerW / (recentGames.length - 1)));
            const getY = (pt) => padY + innerH - ((pt - minPt) / ptRange) * innerH;
            const zeroY = getY(0);
            const pointsStr = recentGames.map((g, i) => `${getX(i)},${getY(g.pt)}`).join(' ');

            return (
              <div className="bg-[#F5F5DC] w-full h-[90%] rounded-t-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom">
                <div className="bg-[#1e293b] rounded-t-3xl p-4 flex justify-between items-center text-white shrink-0">
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2"><PieChart size={20}/> {selectedStatPlayer.name}</h2>
                    <select value={selectedSeason} onChange={(e) => setSelectedSeason(e.target.value)} className="bg-gray-700 text-white text-[10px] font-bold py-1 px-2 mt-1 rounded appearance-none focus:outline-none">
                      <option value="all">전체 시즌</option>
                      {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <button onClick={() => setSelectedStatPlayerName(null)} className="p-1.5 hover:bg-gray-700 rounded-full transition-colors bg-gray-800"><X size={20}/></button>
                </div>
                
                <div className="flex bg-white border-b border-gray-200 shadow-sm shrink-0">
                  {['전체', '4인', '3인'].map(tab => (
                    <button key={tab} onClick={() => setPlayerStatTab(tab)} className={`flex-1 py-3 text-sm font-bold transition-colors ${playerStatTab === tab ? 'text-[#2E7D32] border-b-2 border-[#2E7D32]' : 'text-gray-400 hover:text-gray-600'}`}>
                      {tab}
                    </button>
                  ))}
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 text-center"><span className="block text-[10px] text-gray-500 font-bold mb-1">대국 수</span><span className="text-xl font-black text-gray-800">{mStat.gamesPlayed}국</span></div>
                    {playerStatTab === '전체' ? (
                       <div className="grid grid-cols-2 gap-2">
                         <div className="bg-green-50 p-2 rounded-xl border border-green-100 text-center flex flex-col justify-center">
                           <span className="block text-[9px] text-gray-500 font-bold mb-0.5">4인 우마</span>
                           <span className={`text-lg font-black ${mStat.totalUma4 > 0 ? 'text-[#2E7D32]' : mStat.totalUma4 < 0 ? 'text-red-500' : 'text-gray-800'}`}>{mStat.totalUma4 > 0 ? '+' : ''}{mStat.totalUma4.toFixed(1)}</span>
                         </div>
                         <div className="bg-blue-50 p-2 rounded-xl border border-blue-100 text-center flex flex-col justify-center">
                           <span className="block text-[9px] text-gray-500 font-bold mb-0.5">3인 우마</span>
                           <span className={`text-lg font-black ${mStat.totalUma3 > 0 ? 'text-blue-600' : mStat.totalUma3 < 0 ? 'text-red-500' : 'text-gray-800'}`}>{mStat.totalUma3 > 0 ? '+' : ''}{mStat.totalUma3.toFixed(1)}</span>
                         </div>
                       </div>
                    ) : (
                      <div className="bg-green-50 p-3 rounded-xl shadow-sm border border-green-200 text-center"><span className="block text-[10px] text-green-700 font-bold mb-1">현재 우마</span><span className={`text-xl font-black ${mStat.totalUma > 0 ? 'text-[#2E7D32]' : mStat.totalUma < 0 ? 'text-red-500' : 'text-gray-800'}`}>{mStat.totalUma > 0 ? '+' : ''}{mStat.totalUma.toFixed(1)}</span></div>
                    )}
                  </div>

                  {playerStatTab !== '전체' && (
                    <>
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5"><BarChart size={16}/> 상세 통계</h3>
                        
                        {/* 💡 화료/방총 상세 박스 (비율이 아래로 떨어지게 수정) */}
                        <div className="grid grid-cols-4 gap-2 text-center font-medium mb-3">
                          <div onClick={handleWinBreakdown} className="flex flex-col justify-center cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors active:scale-95 border border-transparent hover:border-gray-200">
                            <span className="text-[10px] text-gray-500 font-bold underline decoration-dotted underline-offset-2 mb-0.5">화료 (상세)</span>
                            <span className="font-black text-[#2E7D32] text-sm">{mStat.winCount}회 <span className="block text-[10px] font-bold text-gray-400 leading-tight">({mStat.winRate}%)</span></span>
                          </div>
                          <div onClick={handleDealInBreakdown} className="flex flex-col justify-center cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors active:scale-95 border border-transparent hover:border-gray-200">
                            <span className="text-[10px] text-gray-500 font-bold underline decoration-dotted underline-offset-2 mb-0.5">방총 (상세)</span>
                            <span className="font-black text-orange-500 text-sm">{mStat.dealInCount}회 <span className="block text-[10px] font-bold text-gray-400 leading-tight">({mStat.dealInRate}%)</span></span>
                          </div>
                          <div className="flex flex-col justify-center p-1"><span className="text-[10px] text-gray-500 font-bold mb-0.5">역만수</span><span className="font-black text-red-600 text-sm">{mStat.yakumanCount}회</span></div>
                          <div className="flex flex-col justify-center p-1"><span className="text-[10px] text-gray-500 font-bold mb-0.5">쵼보수</span><span className="font-black text-purple-600 text-sm">{mStat.chomboCount}회</span></div>
                        </div>

                        {/* 💡 등수 박스 (비율 아래로 스택) */}
                        <div className={`grid ${playerStatTab === '3인' ? 'grid-cols-3' : 'grid-cols-4'} gap-2 text-center font-medium mb-3 bg-gray-50 p-2 rounded-lg`}>
                          {[1, 2, 3, 4].map(rank => {
                            if (playerStatTab === '3인' && rank === 4) return null;
                            const count = mStat.ranks[rank-1];
                            const pct = mStat.gamesPlayed > 0 ? ((count / mStat.gamesPlayed) * 100).toFixed(0) : 0;
                            return (
                              <div key={rank} className="flex flex-col justify-center">
                                <span className="text-[10px] font-bold text-gray-600 mb-0.5">{rank}등수</span>
                                <span className="font-black text-gray-800 text-sm">{count}회 <span className="block text-[9px] text-gray-400 leading-tight">({pct}%)</span></span>
                              </div>
                            )
                          })}
                        </div>

                        {/* 💡 연대율/토비 박스 (우마 기준 횟수 + 비율 스택) */}
                        <div className={`grid ${playerStatTab === '3인' ? 'grid-cols-1' : 'grid-cols-2'} gap-2 text-center font-medium`}>
                          {playerStatTab !== '3인' && (
                            <div className="flex flex-col justify-center border border-blue-100 bg-blue-50 py-2 rounded-lg">
                              <span className="text-[10px] text-blue-700 font-bold mb-0.5">연대율 (1~2등)</span>
                              <span className="font-black text-blue-600 text-sm">{mStat.rentaiCount}회 <span className="block text-[10px] font-medium text-blue-400 leading-tight">({mStat.rentaiRate}%)</span></span>
                            </div>
                          )}
                          <div className="flex flex-col justify-center border border-slate-200 bg-slate-50 py-2 rounded-lg">
                            <span className="text-[10px] text-slate-600 font-bold mb-0.5">들통율 (토비)</span>
                            <span className="font-black text-slate-700 text-sm">{mStat.tobiCount}회 <span className="block text-[10px] font-medium text-slate-400 leading-tight">({mStat.tobiRate}%)</span></span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2"><span className="block text-[9px] text-gray-500 font-bold mb-1">최고 점수</span><span className="text-sm font-black text-gray-800">{mStat.maxScore === -99999 ? 0 : Number(mStat.maxScore).toLocaleString()}</span></div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2"><span className="block text-[9px] text-gray-500 font-bold mb-1">최소 점수</span><span className="text-sm font-black text-gray-800">{mStat.minScore === 99999 ? 0 : Number(mStat.minScore).toLocaleString()}</span></div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2"><span className="block text-[9px] text-gray-500 font-bold mb-1">평균 소점</span><span className="text-sm font-black text-gray-800">{Number(mStat.avgScore).toLocaleString()}</span></div>
                        
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2"><span className="block text-[9px] text-gray-500 font-bold mb-1">최고 타점</span><span className="text-sm font-black text-[#2E7D32]">{mStat.maxWinScore > 0 ? Number(mStat.maxWinScore).toLocaleString() + '점' : '0점'}</span></div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2"><span className="block text-[9px] text-gray-500 font-bold mb-1">평균 타점</span><span className="text-sm font-black text-[#2E7D32]">{Number(mStat.avgWinScore).toLocaleString()}점</span></div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2"><span className="block text-[9px] text-gray-500 font-bold mb-1">평균 우마</span><span className="text-sm font-black text-gray-800">{mStat.avgUma}</span></div>
                        
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2"><span className="block text-[9px] text-gray-500 font-bold mb-1">최고 방총점</span><span className="text-sm font-black text-orange-500">{mStat.maxDealInScore > 0 ? Number(mStat.maxDealInScore).toLocaleString() + '점' : '0점'}</span></div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2"><span className="block text-[9px] text-gray-500 font-bold mb-1">평균 방총점</span><span className="text-sm font-black text-orange-500">{Number(mStat.avgDealInScore).toLocaleString()}점</span></div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2"><span className="block text-[9px] text-gray-500 font-bold mb-1">최대 연장</span><span className="text-sm font-black text-gray-800">{mStat.maxHonba}본장</span></div>
                      </div>

                      {/* 📈 최근 8국 누적 우마 꺾은선 차트 */}
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 relative overflow-hidden mt-4">
                        <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-1.5"><BarChart2 size={16}/> 최근 8국 누적 우마 변동</h3>
                        {recentGames.length === 0 ? (
                          <p className="text-center text-gray-400 py-6 font-bold text-xs">종료된 대국이 없습니다.</p>
                        ) : (
                          <div className="w-full overflow-visible mt-4">
                            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto overflow-visible">
                              {/* 0점 기준선 (화면 내에 있을 때만 보임) */}
                              <line x1={padX} y1={zeroY} x2={chartWidth - padX} y2={zeroY} stroke="#e2e8f0" strokeWidth="2" strokeDasharray="4 4" />
                              
                              {/* 누적 꺾은선 (파란색 메인 라인) */}
                              <polyline points={pointsStr} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                              
                              {/* 데이터 점 및 라벨 */}
                              {recentGames.map((g, i) => {
                                const x = getX(i);
                                const y = getY(g.pt);
                                
                                // 개별 대국의 성적에 따라 점 색상 결정 (올라갔으면 초록, 내려갔으면 빨강)
                                const isGamePositive = g.gamePt > 0;
                                const isGameZero = g.gamePt === 0;
                                const dotColor = isGamePositive ? '#2E7D32' : isGameZero ? '#64748b' : '#ef4444';
                                
                                return (
                                  <g key={`${g.id}-${i}`} className="transition-all duration-300">
                                    {/* 점선 가이드라인 */}
                                    <line x1={x} y1={chartHeight - 10} x2={x} y2={y} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="2 2" />
                                    
                                    {/* 데이터 포인트 */}
                                    <circle cx={x} cy={y} r="4.5" fill="white" stroke={dotColor} strokeWidth="2.5" />
                                    
                                    {/* 💡 누적 우마 합계 라벨 (크게) */}
                                    <text x={x} y={y - 12} textAnchor="middle" fontSize="11" fontWeight="900" fill={g.pt > 0 ? '#2E7D32' : g.pt < 0 ? '#ef4444' : '#64748b'}>
                                      {g.pt > 0 ? `+${g.pt}` : g.pt}
                                    </text>
                                    
                                    {/* 💡 개별 대국 변동폭 라벨 (작게) */}
                                    <text x={x} y={y + 16} textAnchor="middle" fontSize="9" fontWeight="bold" fill={dotColor} opacity="0.8">
                                      ({g.gamePt > 0 ? `+${g.gamePt}` : g.gamePt})
                                    </text>
                                  </g>
                                );
                              })}
                            </svg>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <h3 className="text-sm font-bold text-gray-800 mb-3">모든 사용 역 현황</h3>
                    {Object.keys(mStat.yakus).length === 0 ? <p className="text-xs text-gray-400">기록된 역이 없습니다.</p> : (
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(mStat.yakus).sort((a,b)=>b[1]-a[1]).map(([yaku, count]) => (
                          <span key={yaku} className="bg-green-50 text-green-800 border border-green-200 px-2 py-1 rounded text-[10px] font-bold">{yaku} <span className="text-green-500 ml-0.5">{count}</span></span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <h3 className="text-sm font-bold text-gray-800 mb-3">화료 형태별 비율</h3>
                    <div className="grid grid-cols-3 gap-2 mb-4 bg-gray-50 p-2 rounded-lg text-center">
                      <div><span className="block text-[10px] font-bold text-red-600 mb-0.5">리치 화료율</span><span className="text-sm font-black">{mStat.winCount>0?((mStat.riichiWinCount/mStat.winCount)*100).toFixed(0):0}%</span><span className="block text-[9px] text-gray-400">({mStat.riichiWinCount}회)</span></div>
                      <div><span className="block text-[10px] font-bold text-gray-600 mb-0.5">다마 화료율</span><span className="text-sm font-black">{mStat.winCount>0?((mStat.damaWinCount/mStat.winCount)*100).toFixed(0):0}%</span><span className="block text-[9px] text-gray-400">({mStat.damaWinCount}회)</span></div>
                      <div><span className="block text-[10px] font-bold text-blue-600 mb-0.5">후로 화료율</span><span className="text-sm font-black">{mStat.winCount>0?((mStat.furoWinCount/mStat.winCount)*100).toFixed(0):0}%</span><span className="block text-[9px] text-gray-400">({mStat.furoWinCount}회)</span></div>
                    </div>
                    <div className="space-y-2">
                      {[
                        { label: '멘젠 쯔모', count: mStat.menzenTsumo, color: 'bg-green-500' },
                        { label: '멘젠 론', count: mStat.menzenRon, color: 'bg-[#2E7D32]' },
                        { label: '비멘젠 쯔모', count: mStat.furoTsumo, color: 'bg-blue-400' },
                        { label: '비멘젠 론', count: mStat.furoRon, color: 'bg-orange-400' }
                      ].map(w => {
                        const pct = mStat.winCount > 0 ? ((w.count / mStat.winCount) * 100).toFixed(1) : 0;
                        return (
                          <div key={w.label}>
                            <div className="flex justify-between text-[10px] font-bold text-gray-700 mb-0.5"><span>{w.label}</span><span>{w.count}회 ({pct}%)</span></div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${w.color}`} style={{width: `${pct}%`}}></div></div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
                    <h3 className="text-sm font-bold text-gray-800 mb-3">대기 형태별 비율</h3>
                    <div className="space-y-2">
                      {['양면', '샤보', '간짱', '변짱', '단기', '특수대기'].map(w => {
                        const c = mStat.waitTypes[w] || 0;
                        const pct = mStat.winCount > 0 ? ((c / mStat.winCount) * 100).toFixed(1) : 0;
                        return (
                          <div key={w}>
                            <div className="flex justify-between text-[10px] font-bold text-gray-700 mb-0.5"><span>{w}</span><span>{c}회 ({pct}%)</span></div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-gray-600" style={{width: `${pct}%`}}></div></div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* --------------------------------------------------------- */}
                  {/* ⚔️ 육각형 레이더 차트 (All-Time) */}
                  {/* --------------------------------------------------------- */}
                   {playerStatTab === '전체' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-10 flex flex-col items-center">
                      <h3 className="text-sm font-bold text-gray-800 mb-6 w-full flex items-center gap-1.5">
                        <BarChart2 size={16} className="text-[#2E7D32]"/> 작사 성향 분석 (All-Time)
                      </h3>
                      
                      {/* 육각형 그래프 SVG */}
                      <div className="relative">
                        <svg width="220" height="220" viewBox="0 0 200 200">
                          {/* 배경 그물망 가이드라인 */}
                          {[20, 40, 60, 80, 100].map(t => (
                            <polygon key={t} points={rtRadarData.map((_, i) => rtGetPt(t, i)).join(' ')} fill="none" stroke="#f1f5f9" strokeWidth="1" />
                          ))}
                          {/* 중심에서 뻗어나가는 축 선 */}
                          {rtRadarData.map((_, i) => (
                            <line key={i} x1={rtCenterX} y1={rtCenterY} x2={rtCenterX + rtRadius * Math.cos((Math.PI * 2)/6*i - Math.PI/2)} y2={rtCenterY + rtRadius * Math.sin((Math.PI * 2)/6*i - Math.PI/2)} stroke="#f1f5f9" strokeWidth="1" />
                          ))}
                          {/* 실제 스탯 데이터 영역 */}
                          <polygon points={rtPolyPts} fill="rgba(46, 125, 50, 0.2)" stroke="#2E7D32" strokeWidth="2.5" strokeLinejoin="round" />
                          
                          {/* 외곽 라벨 (화력, 수비 등) */}
                          {rtRadarData.map((d, i) => {
                            const angle = (Math.PI * 2) / 6 * i - (Math.PI / 2);
                            const labelR = rtRadius + 22;
                            const tx = rtCenterX + labelR * Math.cos(angle);
                            const ty = rtCenterY + labelR * Math.sin(angle);
                            return (
                              <text key={i} x={tx} y={ty} textAnchor="middle" fontSize="11" fontWeight="900" fill="#64748b" dominantBaseline="middle">{d.label}</text>
                            );
                          })}
                        </svg>
                      </div>

                      {/* 하단 점수 패널 및 클릭 시 나타나는 툴팁 */}
                      <div className="grid grid-cols-3 gap-3 w-full mt-6 relative">
                        {rtRadarData.map((d, idx) => (
                          <div key={d.label} className="relative">
                            <div 
                              onClick={() => setActiveTooltip(activeTooltip === idx ? null : idx)}
                              className={`bg-gray-50 p-2 rounded-xl border transition-all flex flex-col items-center cursor-pointer ${activeTooltip === idx ? 'border-[#2E7D32] bg-green-50 shadow-inner' : 'border-gray-100'}`}
                            >
                              <div className="flex items-center gap-1 mb-0.5">
                                <span className="text-[10px] text-gray-400 font-black">{d.label}</span>
                                <Info size={10} className={activeTooltip === idx ? 'text-[#2E7D32]' : 'text-gray-300'} />
                              </div>
                              <span className={`text-sm font-black ${activeTooltip === idx ? 'text-[#2E7D32]' : 'text-gray-700'}`}>
                                {Math.round(d.score)}
                              </span>
                            </div>

                            {/* 💡 개별 스탯 설명 툴팁 */}
                            {activeTooltip === idx && (
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 bg-[#1e293b] text-white text-[9px] p-2 rounded-lg shadow-xl z-[110] animate-in fade-in zoom-in duration-200">
                                <div className="font-black border-b border-gray-600 pb-1 mb-1 text-green-400">{d.label} 스탯 공식</div>
                                <div className="whitespace-pre-line leading-relaxed opacity-90">{d.desc}</div>
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-[#1e293b]"></div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* 툴팁 외 영역 클릭 시 닫기용 투명 오버레이 */}
                      {activeTooltip !== null && (
                        <div className="fixed inset-0 z-[105]" onClick={() => setActiveTooltip(null)}></div>
                      )}
                      
                      <p className="text-[9px] text-gray-400 mt-6 font-bold text-center">
                        * 0~100점 척도로 변환된 상대적 지표입니다. (i 클릭 시 공식 확인)
                      </p>
                    </div>
                  )}
                  {/* 💡 레이더 차트 UI 끝 */}

                </div> {/* --- 상세 모달 스크롤 영역(overflow-y-auto)의 끝 --- */}
              </div>
            );
          })()}
        </div>
      )}

      {/* 모달들 (로그인, 마스터, 시즌, 새게임, 대국기록, 대국종료) */}
      {isAuthModalOpen && (
        <div className="absolute inset-0 bg-black bg-opacity-60 z-[70] flex items-center justify-center animate-in fade-in">
          <div className="bg-white w-11/12 max-w-sm rounded-2xl shadow-2xl p-6 relative">
            <button onClick={() => setIsAuthModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20}/></button>
            <div className="flex mb-6 border-b border-gray-200"><button onClick={()=>setAuthMode('login')} className={`flex-1 pb-2 font-bold ${authMode === 'login' ? 'text-[#2E7D32] border-b-2 border-[#2E7D32]' : 'text-gray-400'}`}>로그인</button><button onClick={()=>setAuthMode('signup')} className={`flex-1 pb-2 font-bold ${authMode === 'signup' ? 'text-[#2E7D32] border-b-2 border-[#2E7D32]' : 'text-gray-400'}`}>회원가입</button></div>
            <div className="space-y-4">
              <input type="text" placeholder="이름 (예: 홍길동)" value={authName} onChange={e=>setAuthName(e.target.value)} className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:border-[#2E7D32] font-bold" />
              <input type="password" inputMode="numeric" maxLength={4} placeholder="비밀번호 (숫자 4자리)" value={authPin} onChange={e=>setAuthPin(e.target.value)} className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:border-[#2E7D32] font-bold" />
              {authMode === 'signup' && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl"><span className="block text-xs font-bold text-gray-500 mb-2">요청 권한 선택</span><select value={authRoleReq} onChange={e=>setAuthRoleReq(e.target.value)} className="w-full bg-white p-2 rounded border border-gray-300 font-bold focus:outline-none"><option value="player">작사 (일반 유저)</option><option value="admin">관리자 (시즌 관리 등)</option></select><p className="text-[10px] text-gray-400 mt-2">* 관리자 권한은 마스터의 승인이 필요합니다.</p></div>
              )}
              <button onClick={authMode === 'login' ? handleLogin : handleSignup} className="w-full bg-[#2E7D32] text-white font-bold py-3.5 rounded-xl hover:bg-green-800 active:scale-[0.98]">{authMode === 'login' ? '로그인' : '가입하기'}</button>
            </div>
          </div>
        </div>
      )}

      {isMasterModalOpen && (
        <div className="absolute inset-0 bg-black bg-opacity-70 z-[80] flex flex-col justify-end animate-in fade-in">
          <div className="bg-gray-100 w-full h-[85%] rounded-t-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom">
            <div className="bg-yellow-600 rounded-t-3xl p-4 flex justify-between items-center text-white"><h2 className="text-lg font-bold flex items-center gap-2"><Shield size={18}/> 마스터 대시보드</h2><button onClick={() => setIsMasterModalOpen(false)} className="p-1 hover:bg-yellow-700 rounded-full"><X size={20}/></button></div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <h3 className="font-bold text-gray-700 text-sm mb-2">가입된 유저 관리 ({allUsers.length}명)</h3>
              {allUsers.filter(u => u.role !== 'master').map(user => (
                <div key={user.name} className="bg-white p-3 rounded-xl shadow-sm border border-gray-200">
                  <div className="flex justify-between items-center mb-2"><span className="font-bold text-lg text-gray-800">{user.name}</span><span className={`text-[10px] px-2 py-1 rounded font-bold ${user.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{user.role === 'admin' ? '🛡️ 관리자' : '♟️ 작사'}</span></div>
                  
                  {/* 기존: 관리자 승인 요청 UI */}
                  {user.pendingAdmin && (
                    <div className="bg-yellow-50 border border-yellow-200 p-2 rounded-lg mb-2 flex items-center justify-between"><span className="text-xs font-bold text-yellow-700">⚠️ 관리자 권한 요청됨</span><div className="flex gap-1"><button onClick={() => handleApproveAdmin(user.name)} className="bg-green-500 text-white p-1 rounded hover:bg-green-600"><UserCheck size={16}/></button><button onClick={() => handleRejectAdmin(user.name)} className="bg-gray-400 text-white p-1 rounded hover:bg-gray-500"><X size={16}/></button></div></div>
                  )}

                  {/* 💡 추가됨: 일반 작사 쓰기 권한 승인 대기 UI */}
                  {user.isApproved === false && !user.pendingAdmin && (
                    <div className="bg-green-50 border border-green-200 p-2 rounded-lg mb-2 flex items-center justify-between">
                      <span className="text-xs font-bold text-green-700">⚠️ 쓰기 권한(작사) 요청됨</span>
                      <button onClick={() => handleApproveUser(user.name)} className="bg-[#2E7D32] text-white px-2 py-1 text-xs font-bold rounded flex items-center gap-1 hover:bg-green-800"><UserCheck size={14}/> 승인</button>
                    </div>
                  )}

                  <div className="flex gap-2 mt-2">
                    {user.role === 'admin' ? (<button onClick={() => handleDemotePlayer(user.name)} className="flex-1 py-2 bg-orange-100 text-orange-700 font-bold text-xs rounded-lg flex justify-center items-center gap-1 hover:bg-orange-200"><ShieldClose size={14}/> 권한 강등</button>) : (<button onClick={() => handlePromoteAdmin(user.name)} className="flex-1 py-2 bg-blue-50 text-blue-600 font-bold text-xs rounded-lg flex justify-center items-center gap-1 hover:bg-blue-100"><Shield size={14}/> 관리자 임명</button>)}
                    <button onClick={() => handleRemoveUser(user.name)} className="flex-1 py-2 bg-red-50 text-red-600 font-bold text-xs rounded-lg flex justify-center items-center gap-1 hover:bg-red-100"><UserX size={14}/> 회원 삭제</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isSeasonModalOpen && (
        <div className="absolute inset-0 bg-black bg-opacity-60 z-[70] flex items-center justify-center animate-in fade-in">
          <div className="bg-white w-11/12 max-w-md rounded-2xl shadow-2xl p-5 relative max-h-[90%] flex flex-col">
            <button onClick={() => {setIsSeasonModalOpen(false); handleCancelEditSeason();}} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20}/></button>
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><CalendarPlus size={20}/> 시즌 관리</h2>
            
            {/* 등록된 시즌 목록 */}
            <div className="flex-1 overflow-y-auto mb-4 space-y-2 border border-gray-100 rounded-xl p-2 bg-gray-50 max-h-[40vh]">
              {seasons.map(s => (
                <div key={s.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex justify-between items-center">
                  <div>
                    <div className="font-bold text-gray-800 text-sm">{s.name}</div>
                    {(s.startDate || s.endDate) && (
                      <div className="text-[10px] text-gray-500 mt-0.5">{s.startDate || '미정'} ~ {s.endDate || '미정'}</div>
                    )}
                  </div>
                  <button onClick={() => handleEditSeasonClick(s)} className="text-gray-400 hover:text-[#2E7D32] p-1.5"><Edit size={16}/></button>
                </div>
              ))}
            </div>

            {/* 새 시즌 추가 및 수정 폼 */}
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-3">
              <h3 className="text-xs font-bold text-gray-600">{editingSeasonId ? '시즌 정보 수정' : '새 시즌 추가'}</h3>
              <input type="text" placeholder="시즌 이름 (예: 2026 상반기)" value={newSeasonName} onChange={e=>setNewSeasonName(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:border-[#2E7D32] text-sm font-bold" />
              
              <div className="flex gap-2">
                <div className="flex-1">
                  <span className="block text-[10px] text-gray-500 mb-1 ml-1 font-bold">시작일</span>
                  <input type="date" value={newSeasonStart} onChange={e=>setNewSeasonStart(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#2E7D32] text-xs text-gray-700 font-bold bg-white" />
                </div>
                <div className="flex-1">
                  <span className="block text-[10px] text-gray-500 mb-1 ml-1 font-bold">종료일</span>
                  <input type="date" value={newSeasonEnd} onChange={e=>setNewSeasonEnd(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:border-[#2E7D32] text-xs text-gray-700 font-bold bg-white" />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                {editingSeasonId && <button onClick={handleCancelEditSeason} className="flex-1 bg-gray-200 text-gray-700 font-bold py-2.5 rounded-lg hover:bg-gray-300 text-sm transition-colors">취소</button>}
                <button onClick={handleSaveSeason} className={`flex-1 text-white font-bold py-2.5 rounded-lg text-sm transition-colors ${editingSeasonId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-[#2E7D32] hover:bg-green-800'}`}>
                  {editingSeasonId ? '저장' : '추가'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 대국 추가 모달 */}
      {isNewGameModalOpen && (
        <div className="absolute inset-0 bg-black bg-opacity-60 z-50 flex flex-col justify-end animate-in fade-in">
          <div className="bg-[#F5F5DC] w-full h-[80%] rounded-t-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom">
            <div className="bg-[#2E7D32] rounded-t-3xl p-4 flex justify-between items-center text-white"><h2 className="text-lg font-bold">{newGameType} 대국 시작</h2><button onClick={() => setIsNewGameModalOpen(false)} className="p-1 hover:bg-green-700 rounded-full"><X size={20} /></button></div>
            <div className="p-5 flex-1 overflow-y-auto">
              
              {/* 💡 대국 일자 입력란 추가 */}
              <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-gray-100 mb-5">
                <div className="bg-gray-700 text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shadow-inner"><CalendarPlus size={14}/></div>
                <input type="date" value={newGameDate} onChange={e => setNewGameDate(e.target.value)} className="flex-1 text-sm font-bold bg-transparent focus:outline-none text-gray-800" />
              </div>

              <div className="flex items-center gap-2 mb-4"><Users className="text-[#2E7D32]" /><p className="text-gray-800 font-bold text-sm">초기 좌석을 입력해주세요</p></div>
              {/* ... (이하 동/남/서/북 입력칸 동일) ... */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-gray-100"><div className="bg-[#2E7D32] text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shadow-inner">동</div><input type="text" value={playerE} onChange={e => setPlayerE(e.target.value)} placeholder="동가 이름" className="flex-1 text-sm font-bold bg-transparent focus:outline-none" /></div>
                <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-gray-100"><div className="bg-[#2E7D32] text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shadow-inner">남</div><input type="text" value={playerS} onChange={e => setPlayerS(e.target.value)} placeholder="남가 이름" className="flex-1 text-sm font-bold bg-transparent focus:outline-none" /></div>
                <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-gray-100"><div className="bg-[#2E7D32] text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shadow-inner">서</div><input type="text" value={playerW} onChange={e => setPlayerW(e.target.value)} placeholder="서가 이름" className="flex-1 text-sm font-bold bg-transparent focus:outline-none" /></div>
                {newGameType === '4인' && (<div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-gray-100"><div className="bg-[#2E7D32] text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shadow-inner">북</div><input type="text" value={playerN} onChange={e => setPlayerN(e.target.value)} placeholder="북가 이름" className="flex-1 text-sm font-bold bg-transparent focus:outline-none" /></div>)}
              </div>
              <button onClick={handleCreateNewGame} className="w-full bg-[#2E7D32] text-white font-bold text-sm py-3.5 rounded-xl mt-6 shadow-md hover:bg-green-800 active:scale-[0.98] transition-all">대국 시작하기</button>
            </div>
          </div>
        </div>
      )}

      {isRoundModalOpen && (
        <div className="absolute inset-0 bg-[#F5F5DC] z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom">
          <div className="bg-[#2E7D32] text-white p-4 flex justify-between items-center pt-10 shadow-sm z-10">
            <button onClick={() => setIsRoundModalOpen(false)}><ChevronLeft size={28} /></button>
            <h2 className="text-xl font-bold">{editingRoundId ? '기록 수정' : `${wind}${roundNum}국 기록`}</h2>
            <button onClick={handleSaveRound} className="text-sm font-bold bg-green-700 px-3 py-1 rounded hover:bg-green-600">저장</button>
          </div>
          <div className="flex bg-white shadow-sm z-10 text-sm"><button onClick={() => setRecordMode('화료')} className={`flex-1 py-4 font-bold border-b-4 transition-colors ${recordMode === '화료' ? 'border-[#2E7D32] text-[#2E7D32]' : 'border-transparent text-gray-400'}`}>화료</button><button onClick={() => setRecordMode('유국')} className={`flex-1 py-4 font-bold border-b-4 transition-colors ${recordMode === '유국' ? 'border-gray-600 text-gray-700' : 'border-transparent text-gray-400'}`}>유국</button><button onClick={() => setRecordMode('촌보')} className={`flex-1 py-4 font-bold border-b-4 transition-colors ${recordMode === '촌보' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-400'}`}>촌보</button></div>
          <div className="flex-1 overflow-y-auto p-4 space-y-8 pb-32">
            
            {/* 💡 요청 반영: 국풍 균등 배치, 국 번호/본장 같은 행, 공탁 삭제 */}
            <section className="space-y-2">
              <h3 className="font-bold text-base text-gray-800 border-b pb-1">국 / 본장</h3>
              
              {/* 국풍 */}
              {/* 💡 간격을 gap-4로 통일 */}
              <div className="flex items-center bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm gap-4">
                 {/* 💡 글자 영역을 w-8로 고정 */}
                 <span className="font-bold text-green-700 text-sm w-8 text-center shrink-0 ml-1">국풍</span>
                 <div className="flex-1 flex gap-1.5">
                    {['동', '남', '서', '북'].map(w => (
                      <button key={w} onClick={() => { setWind(w); setHonba(0); }} className={`flex-1 py-1.5 text-sm rounded-lg font-bold border transition-colors ${wind === w ? 'bg-[#2E7D32] border-[#2E7D32] text-white shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>{w}</button>
                    ))}
                 </div>
              </div>

              <div className="flex gap-2">
                {/* 국 번호 */}
                {/* 💡 국풍과 똑같이 gap-4 적용 */}
                <div className="flex-1 flex items-center bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm gap-4">
                   {/* 💡 국풍과 똑같이 글자 영역을 w-8로 고정하여 버튼 시작 지점을 완벽하게 맞춤 */}
                   <span className="font-bold text-[#2E7D32] text-sm w-8 text-center shrink-0 ml-1">국</span>
                   <div className="flex-1 flex gap-1.5">
                      {(currentGame?.type === '3인' ? [1, 2, 3] : [1, 2, 3, 4]).map(num => (
                        <button key={num} onClick={() => { setRoundNum(num); setHonba(0); }} className={`flex-1 py-1.5 text-sm rounded-lg font-bold border transition-colors ${roundNum === num ? 'bg-[#2E7D32] border-[#2E7D32] text-white shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>{num}</button>
                      ))}
                   </div>
                </div>

                {/* 본장 */}
                <div className="flex-1 flex justify-between p-2.5 bg-white rounded-xl border border-gray-100 shadow-sm items-center">
                  <span className="font-bold text-gray-700 text-sm ml-1">본장</span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setHonba(Math.max(0, honba - 1))} className="bg-gray-100 w-8 h-8 rounded font-bold hover:bg-gray-200">-</button>
                    <span className="font-bold text-lg w-5 text-center text-gray-800">{honba}</span>
                    <button onClick={() => setHonba(honba + 1)} className="bg-gray-100 w-8 h-8 rounded font-bold hover:bg-gray-200">+</button>
                  </div>
                </div>
              </div>
            </section>

            {recordMode === '화료' ? (
              <>
                <section className="space-y-3"><h3 className="font-bold text-base text-gray-800 border-b pb-1">화료 형태</h3><div className="flex gap-2"><button onClick={() => handleWinTypeChange('쯔모')} className={`flex-1 py-3 rounded-xl font-bold border-2 ${winType === '쯔모' ? 'border-[#2E7D32] bg-[#2E7D32] text-white' : 'bg-white text-gray-400 border-gray-100'}`}>쯔모</button><button onClick={() => handleWinTypeChange('론')} className={`flex-1 py-3 rounded-xl font-bold border-2 ${winType === '론' ? 'border-[#2E7D32] bg-[#2E7D32] text-white' : 'bg-white text-gray-400 border-gray-100'}`}>론</button></div><div className="flex gap-2"><button onClick={() => setMenzen('멘젠')} className={`flex-1 py-3 rounded-xl font-bold border-2 ${menzen === '멘젠' ? 'border-[#2E7D32] bg-[#2E7D32] text-white' : 'bg-white text-gray-400 border-gray-100'}`}>멘젠</button><button onClick={() => setMenzen('비멘젠')} className={`flex-1 py-3 rounded-xl font-bold border-2 ${menzen === '비멘젠' ? 'border-[#2E7D32] bg-[#2E7D32] text-white' : 'bg-white text-gray-400 border-gray-100'}`}>비멘젠</button></div></section>
                <section className="space-y-2">
                  <div className="flex justify-between items-end">
                    <h3 className="font-bold text-base text-gray-800">화료자 / 방총자</h3>
                    <p className="text-[10px] text-gray-400 font-medium">클릭: 화료 / 길게(0.3초) 누르기: 방총</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {players.map((player, index) => (
                      <button 
                        key={index} 
                        onTouchStart={() => handlePlayerPressStart(index)} 
                        onTouchEnd={handlePlayerPressEnd} 
                        onMouseDown={() => handlePlayerPressStart(index)} 
                        onMouseUp={handlePlayerPressEnd} 
                        onMouseLeave={handlePlayerPressEnd} 
                        onClick={() => handlePlayerClick(index)} 
                        className={`relative h-14 rounded-xl font-bold text-base transition-all border-2 select-none ${winner === index ? 'bg-[#2E7D32] border-[#2E7D32] text-white shadow-inner' : loser === index ? 'bg-orange-500 border-orange-500 text-white shadow-inner' : 'bg-white border-gray-200 text-gray-800'}`}
                      >
                        {winner === index && <span className="absolute top-1 left-2 text-[9px] bg-white text-[#2E7D32] px-1 rounded font-black shadow-sm">화료</span>}
                        {loser === index && <span className="absolute top-1 left-2 text-[9px] bg-white text-orange-600 px-1 rounded font-black shadow-sm">방총</span>}
                        {player}
                      </button>
                    ))}
                  </div>
                </section>
                <section className="space-y-2"><h3 className="font-bold text-base text-gray-800">대기 형태</h3><div className="grid grid-cols-3 gap-2">{['양면', '샤보', '간짱', '변짱', '단기', '특수대기'].map(t => <button key={t} onClick={() => setWaitType(t)} className={`p-2.5 rounded-xl text-center text-sm font-bold border-2 ${waitType === t ? 'border-[#2E7D32] bg-[#2E7D32] text-white' : 'bg-white border-gray-100 text-gray-600'}`}>{t}</button>)}</div></section>
                <section className="space-y-4">
                  <div className="flex justify-between items-end border-b pb-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-gray-800">역 선택</h3>
                      {menzen === '비멘젠' && <span className="text-[10px] text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">비멘젠: 후로 감소 자동 적용</span>}
                    </div>
                    <span className="text-xs font-bold text-[#2E7D32]">선택됨: {selectedYaku.length}개</span>
                  </div>
                  {Object.entries(yakuData).map(([category, yakus]) => (
                    <div key={category} className="space-y-1.5">
                      <h4 className="font-bold text-[#2E7D32] text-xs">{category}</h4>
                      <div className="grid grid-cols-3 gap-1.5">
                        {yakus.map(yaku => { 
                          if (currentGame?.type === '3인' && yaku === '삼색동순') return null; 
                          const isSelected = selectedYaku.includes(yaku); 
                          const isDisabled = menzen === '비멘젠' && menzenOnlyYaku.includes(yaku);
                          const isDecreased = menzen === '비멘젠' && targetFuroYaku.includes(yaku); 
                          
                          return (
                            <button 
                              key={yaku} 
                              onClick={() => !isDisabled && toggleYaku(yaku)} 
                              disabled={isDisabled}
                              className={`relative p-2 rounded-lg text-xs font-bold border transition-colors select-none ${isDisabled ? 'bg-gray-100 border-gray-200 text-gray-400 opacity-50 cursor-not-allowed' : isSelected ? 'bg-green-50 border-[#2E7D32] text-[#2E7D32] shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                            >
                              {isSelected && isDecreased && <span className="absolute -top-2 left-1 text-[8px] bg-orange-100 border border-orange-400 text-orange-600 px-1 rounded shadow-sm">후로 감소 (-1)</span>}
                              {yaku}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </section>
                
                {/* 💡 요청 4 반영: 부수 2줄 버튼 패드로 교체 */}
                <section className="space-y-3">
                  <h3 className="font-bold text-base text-gray-800 border-b pb-1">도라 / 판수 / 부수</h3>
                  <div className="grid grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-sm"><div className="flex justify-between items-center"><span className="font-bold text-amber-600 text-sm">도라</span><div className="flex items-center gap-2"><button onClick={() => setDora(Math.max(0, dora - 1))} className="w-6 h-6 bg-gray-100 rounded font-bold">-</button><span className="w-4 text-center font-bold">{dora}</span><button onClick={() => setDora(dora + 1)} className="w-6 h-6 bg-gray-100 rounded font-bold">+</button></div></div><div className="flex justify-between items-center"><span className="font-bold text-amber-600 text-sm">적도라</span><div className="flex items-center gap-2"><button onClick={() => setAka(Math.max(0, aka - 1))} className="w-6 h-6 bg-gray-100 rounded font-bold">-</button><span className="w-4 text-center font-bold">{aka}</span><button onClick={() => setAka(aka + 1)} className="w-6 h-6 bg-gray-100 rounded font-bold">+</button></div></div><div className="flex justify-between items-center"><span className="font-bold text-amber-600 text-sm">뒷도라</span><div className="flex items-center gap-2"><button onClick={() => setUra(Math.max(0, ura - 1))} className="w-6 h-6 bg-gray-100 rounded font-bold">-</button><span className="w-4 text-center font-bold">{ura}</span><button onClick={() => setUra(ura + 1)} className="w-6 h-6 bg-gray-100 rounded font-bold">+</button></div></div>
                  {currentGame?.type === '3인' && (<div className="flex justify-between items-center"><span className="font-bold text-amber-600 text-sm">북도라</span><div className="flex items-center gap-2"><button onClick={() => setPei(Math.max(0, pei - 1))} className="w-6 h-6 bg-gray-50 text-gray-700 rounded font-bold hover:bg-gray-100">-</button><span className="w-4 text-center font-bold">{pei}</span><button onClick={() => setPei(pei + 1)} className="w-6 h-6 bg-gray-50 text-gray-700 rounded font-bold hover:bg-gray-100">+</button></div></div>)}</div>
                  
                  {/* 💡 판수를 부수 위로 끌어올림 */}
                  <div className="flex-1 flex justify-between p-3 bg-green-50 rounded-xl border border-green-200 items-center relative shadow-sm">
                    <span className="absolute -top-2 left-2 bg-green-200 text-green-800 text-[9px] px-1 rounded font-bold shadow-sm">역에 따라 자동계산</span>
                    <span className="font-bold text-[#2E7D32] text-sm">판수</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setHan(Math.max(1, han - 1))} className="bg-white w-8 h-8 rounded font-bold shadow-sm hover:bg-gray-50">-</button>
                      <span className="font-black text-xl w-6 text-center text-[#2E7D32]">{han}</span>
                      <button onClick={() => setHan(han + 1)} className="bg-white w-8 h-8 rounded font-bold shadow-sm hover:bg-gray-50">+</button>
                    </div>
                  </div>

                  {/* 💡 5판 미만일 때만 부수 선택창 노출 */}
                  {han < 5 && (
                    <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-2">
                      <div className="flex justify-between items-center"><span className="font-bold text-[#2E7D32] text-sm">부수 선택</span><span className="font-black text-lg text-[#2E7D32]">{fu}부</span></div>
                      <div className="grid grid-cols-6 gap-1">
                        {[20, 25, 30, 40, 50, 60].map(f => (
                          <button key={f} onClick={() => setFu(f)} className={`py-1.5 rounded text-xs font-bold border transition-colors ${fu === f ? 'bg-[#2E7D32] text-white border-[#2E7D32] shadow-sm' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}>{f}</button>
                        ))}
                      </div>
                      <div className="grid grid-cols-6 gap-1">
                        {[70, 80, 90, 100, 110, null].map((f, idx) => (
                          f ? (
                            <button key={f} onClick={() => setFu(f)} className={`py-1.5 rounded text-xs font-bold border transition-colors ${fu === f ? 'bg-[#2E7D32] text-white border-[#2E7D32] shadow-sm' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}>{f}</button>
                          ) : (
                            <div key={`blank-${idx}`}></div>
                          )
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              </>
            ) : recordMode === '유국' ? (
              <>
                <section className="space-y-3"><div className="flex justify-between items-end border-b pb-1"><h3 className="font-bold text-base text-gray-800">텐파이 플레이어</h3><p className="text-[10px] text-gray-400">선택 안하면 전원 노텐</p></div><div className="grid grid-cols-2 gap-2">{players.map((player, index) => <button key={`tenpai-${index}`} onClick={() => toggleTenpai(index)} disabled={abortiveType !== null} className={`h-12 rounded-xl font-bold text-sm transition-all border-2 select-none ${tenpaiPlayers.includes(index) ? 'bg-[#2E7D32] border-[#2E7D32] text-white shadow-inner' : 'bg-white border-gray-200 text-gray-800 disabled:opacity-50'}`}>{player}</button>)}</div></section>
                <section className="space-y-3"><div className="flex justify-between items-end border-b pb-1"><h3 className="font-bold text-base text-gray-800">유국만관</h3></div><div className="grid grid-cols-2 gap-2">{players.map((player, index) => <button key={`nagashi-${index}`} onClick={() => toggleNagashi(index)} disabled={abortiveType !== null} className={`h-12 rounded-xl font-bold text-sm transition-all border-2 select-none ${nagashiMangan.includes(index) ? 'bg-red-500 border-red-500 text-white shadow-inner' : 'bg-white border-gray-200 text-gray-600 disabled:opacity-50'}`}>{player}</button>)}</div></section>
                <section className="space-y-3"><div className="flex justify-between items-end border-b pb-1"><h3 className="font-bold text-base text-gray-800">도중유국 (선택)</h3></div><div className="grid grid-cols-2 gap-2">{abortiveDraws.map(type => <button key={type} onClick={() => toggleAbortive(type)} className={`h-12 rounded-xl text-center font-bold text-sm border-2 transition-colors ${abortiveType === type ? 'bg-gray-700 border-gray-700 text-white shadow-inner' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>{type}</button>)}</div></section>
              </>
            ) : (
              <>
                <section className="space-y-3"><div className="flex justify-between items-end border-b pb-1"><h3 className="font-bold text-base text-red-600">촌보 플레이어 선택</h3></div><div className="grid grid-cols-2 gap-2">{players.map((player, index) => <button key={`chombo-${index}`} onClick={() => setChomboPlayer(index)} className={`h-14 rounded-xl font-bold text-base transition-all border-2 select-none ${chomboPlayer === index ? 'bg-red-500 border-red-500 text-white shadow-inner' : 'bg-white border-gray-200 text-gray-800'}`}>{player}</button>)}</div></section>
              </>
            )}
            <section className="pt-4 border-t border-gray-200"><textarea placeholder="해당 국에 대한 메모나 코멘트를 자유롭게 적어주세요. (선택)" value={roundComment} onChange={(e) => setRoundComment(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#2E7D32] h-20 resize-none shadow-sm"></textarea></section>
          </div>
          <div className="p-4 bg-white border-t border-gray-200 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] z-10"><button onClick={handleSaveRound} className={`w-full text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${recordMode === '화료' ? 'bg-[#2E7D32] hover:bg-green-800' : recordMode === '유국' ? 'bg-gray-700 hover:bg-gray-800' : 'bg-red-600 hover:bg-red-700'}`}><Check size={20} strokeWidth={3} /> {recordMode === '화료' ? '화료 기록 저장' : recordMode === '유국' ? '유국 기록 저장' : '촌보 기록 저장'}</button></div>
        </div>
      )}

      {/* 대국 종료 폼 */}
      {isEndGameModalOpen && (
        <div className="absolute inset-0 bg-black bg-opacity-60 z-[60] flex flex-col justify-end animate-in fade-in">
          <div className="bg-[#F5F5DC] w-full h-[70%] rounded-t-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom">
            <div className="bg-[#1e293b] rounded-t-3xl p-4 flex justify-between items-center text-white"><h2 className="text-lg font-bold flex items-center gap-2"><Flag size={18} /> 대국 결과 입력</h2><button onClick={() => setIsEndGameModalOpen(false)} className="p-1 hover:bg-gray-700 rounded-full"><X size={20} /></button></div>
            <div className="p-4 flex-1 overflow-y-auto space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-lg text-xs font-bold shadow-sm">⚠️ 소점 총합은 {players.length === 4 ? '100,000' : '105,000'}점이어야 합니다.<br/>현재 입력 합계: <span className="text-red-500">{finalScores.reduce((sum, f) => sum + (parseInt(f.score) || 0), 0).toLocaleString()}점</span></div>
              <div className="space-y-2">{players.map((p, i) => (<div key={i} className="flex gap-3 items-center bg-white p-3 rounded-xl border border-gray-200 shadow-sm"><span className="w-14 font-bold truncate text-gray-800 text-sm">{p}</span><input type="text" placeholder="소점 (예: -500)" value={finalScores[i]?.score ?? ''} onChange={(e) => updateFinalScore(i, e.target.value)} className="flex-1 p-2 bg-gray-50 border border-gray-200 rounded-lg text-right font-bold text-sm focus:outline-none focus:border-[#2E7D32]" /></div>))}</div>
              <p className="text-center text-gray-400 text-[10px] font-bold mt-2">※ PT(우마/오카)는 자동 계산됩니다.</p>
            </div>
            <div className="p-4 bg-white border-t border-gray-200 shadow-md"><button onClick={handleConfirmEndGame} className="w-full bg-[#1e293b] text-white font-bold text-sm py-3.5 rounded-xl hover:bg-gray-800 active:scale-[0.98] transition-all">결과 저장 및 대국 종료</button></div>
          </div>
        </div>
      )}

      {/* 네비게이션 바 */}
      <nav className="fixed bottom-0 w-full bg-white border-t border-gray-200 flex justify-around p-2 pb-6 z-10">
        <button className={`flex flex-col items-center p-2 transition-colors ${activeNav === '기록' ? 'text-[#2E7D32]' : 'text-gray-400'}`} onClick={() => {setActiveNav('기록'); setSelectedGameId(null);}}><List size={24} /><span className="text-[10px] mt-1 font-bold">기록</span></button>
        <button className={`flex flex-col items-center p-2 transition-colors ${activeNav === '통계' ? 'text-[#2E7D32]' : 'text-gray-400'}`} onClick={() => setActiveNav('통계')}><BarChart2 size={24} /><span className="text-[10px] mt-1 font-bold">통계</span></button>
        {/* 💡 라이벌 탭 추가 */}
        <button className={`flex flex-col items-center p-2 transition-colors ${activeNav === '라이벌' ? 'text-[#2E7D32]' : 'text-gray-400'}`} onClick={() => setActiveNav('라이벌')}><Swords size={24} /><span className="text-[10px] mt-1 font-bold">라이벌</span></button>
        <button className={`flex flex-col items-center p-2 transition-colors ${activeNav === '랭킹' ? 'text-[#2E7D32]' : 'text-gray-400'}`} onClick={() => setActiveNav('랭킹')}><Trophy size={24} /><span className="text-[10px] mt-1 font-bold">랭킹</span></button>
        <button className={`flex flex-col items-center p-2 transition-colors ${activeNav === '업데이트' ? 'text-[#2E7D32]' : 'text-gray-400'}`} onClick={() => {setActiveNav('업데이트'); setSelectedGameId(null);}}><Bell size={24} /><span className="text-[10px] mt-1 font-bold">설정</span></button>
      </nav>
    </div>
  );
}

export default App;