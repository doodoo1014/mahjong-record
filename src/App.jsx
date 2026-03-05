import { useState, useRef, useEffect, useMemo } from 'react';
import { Gamepad2, Plus, List, BarChart2, Trophy, ChevronLeft, Check, Trash2, ShieldAlert, Users, X, Flag, Edit, Lock, Unlock, Search, CalendarPlus, Shield, UserCheck, ShieldClose, UserX, MessageSquare, AlertOctagon, PieChart, BarChart, Bell } from 'lucide-react';
import { db } from './firebase'; 
import { collection, doc, setDoc, getDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore'; 

const yakuData = {
  '1판 역': ['리치', '일발', '멘젠쯔모', '탕야오', '핑후', '이페코', '백', '발', '중', '자풍패', '장풍패', '해저로월', '하저로어', '영상개화', '창깡'],
  '2판 역': ['더블리치', '치또이쯔', '일기통관', '삼색동순', '삼색동각', '또이또이', '산안커', '찬타', '소삼원', '혼노두', '산깡쯔'],
  '3판 역': ['혼일색', '준찬타', '량페코'],
  '6판 역': ['청일색'],
  '역만': ['천화', '지화', '인화', '스안커', '국사무쌍', '대삼원', '구련보등', '소사희', '자일색', '녹일색', '청노두', '스깡쯔', '대차륜', '대죽림', '대수린', '석상삼년'],
  '더블역만': ['대사희', '스안커 단기', '국사무쌍 13면 대기', '순정구련보등', '홍공작', '대칠성']
}
const targetFuroYaku = ['일기통관', '삼색동순', '찬타', '준찬타', '혼일색', '청일색'];
const abortiveDraws = ['구종구패', '사풍연타', '사깡유국', '사가리치'];
const ADMIN_PIN = '0000';
const fuList = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110];

function App() {
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

  useEffect(() => {
    const qGames = query(collection(db, 'games'), orderBy('id', 'desc'));
    const unsubGames = onSnapshot(qGames, (snapshot) => { setGames(snapshot.docs.map(doc => doc.data())); setIsLoading(false); });
    const unsubSeasons = onSnapshot(doc(db, 'settings', 'seasons'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().list) setSeasons(docSnap.data().list);
      else setDoc(doc(db, 'settings', 'seasons'), { list: [{ id: 'season_1', name: '시즌 1', startDate: '', endDate: '' }] });
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
    if (authName === '마스터') { initialRole = 'master'; approved = true; alert('최고 관리자(마스터) 계정이 생성되었습니다!'); } 
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
  const handleApproveUser = async (name) => { await updateDoc(doc(db, 'users', name), { isApproved: true }); }; // 💡 쓰기 권한 승인 함수
  const handleApproveAdmin = async (name) => { await updateDoc(doc(db, 'users', name), { role: 'admin', pendingAdmin: false, isApproved: true }); };
  const handleRejectAdmin = async (name) => { await updateDoc(doc(db, 'users', name), { pendingAdmin: false }); };
  const handlePromoteAdmin = async (name) => { await updateDoc(doc(db, 'users', name), { role: 'admin' }); };
  const handleDemotePlayer = async (name) => { await updateDoc(doc(db, 'users', name), { role: 'player' }); };
  const handleRemoveUser = async (name) => { if(confirm(`${name} 유저를 완전히 삭제하시겠습니까?`)) await deleteDoc(doc(db, 'users', name)); };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeason, setSelectedSeason] = useState('all'); 
  const [isSeasonModalOpen, setIsSeasonModalOpen] = useState(false);
  
  // 💡 시즌 관리용 확장 상태
  const [newSeasonName, setNewSeasonName] = useState('');
  const [newSeasonStart, setNewSeasonStart] = useState('');
  const [newSeasonEnd, setNewSeasonEnd] = useState('');
  const [editingSeasonId, setEditingSeasonId] = useState(null); // 수정 모드 판별용

  const handleSaveSeason = async () => {
    if (!newSeasonName.trim()) return alert("시즌 이름을 입력해주세요.");
    
    let newSeasonList;
    if (editingSeasonId) {
      // 기존 시즌 수정
      newSeasonList = seasons.map(s => 
        s.id === editingSeasonId ? { ...s, name: newSeasonName, startDate: newSeasonStart, endDate: newSeasonEnd } : s
      );
    } else {
      // 새 시즌 추가
      newSeasonList = [...seasons, { id: `season_${Date.now()}`, name: newSeasonName, startDate: newSeasonStart, endDate: newSeasonEnd }];
    }
    
    await setDoc(doc(db, 'settings', 'seasons'), { list: newSeasonList });
    
    // 입력창 초기화
    setNewSeasonName(''); setNewSeasonStart(''); setNewSeasonEnd(''); setEditingSeasonId(null);
  };

  const handleEditSeasonClick = (season) => {
    setNewSeasonName(season.name);
    setNewSeasonStart(season.startDate || '');
    setNewSeasonEnd(season.endDate || '');
    setEditingSeasonId(season.id);
  };

  const handleCancelEditSeason = () => {
    setNewSeasonName(''); setNewSeasonStart(''); setNewSeasonEnd(''); setEditingSeasonId(null);
  };

  const displayedGames = games.filter(g => {
    if (activeTab !== '전체' && g.type !== activeTab) return false;
    if (selectedSeason !== 'all' && g.seasonId !== selectedSeason) return false;
    if (searchQuery) {
      const matchDate = g.date.includes(searchQuery);
      const matchPlayer = g.players.some(p => p.includes(searchQuery));
      if (!matchDate && !matchPlayer) return false;
    }
    return true;
  });

  const [selectedGameId, setSelectedGameId] = useState(null); 
  const [isNewGameModalOpen, setIsNewGameModalOpen] = useState(false);
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
  const [editingRoundId, setEditingRoundId] = useState(null); // 💡 수정 모드 식별용 상태

  const currentGame = games.find(g => g.id === selectedGameId);
  const records = currentGame ? currentGame.rounds : [];
  const players = currentGame ? currentGame.players : [];

  const totalRecords = records.length;
  const winRecords = records.filter(r => r.type === '화료');
  const tsumoCount = winRecords.filter(r => r.winType === '쯔모').length;
  const ronCount = winRecords.filter(r => r.winType === '론').length;
  const drawCount = records.filter(r => r.type === '유국').length; // 💡 평균판수 대신 유국 수 계산
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
    });
    calcHan -= furoDecreased.length;
    calcHan += dora + aka + ura;
    if (activeTab === '3인' || currentGame?.type === '3인') calcHan += pei;
    setHan(calcHan > 0 ? calcHan : 1);
  }, [selectedYaku, furoDecreased, dora, aka, ura, pei, activeTab, currentGame, recordMode]);

  const playerTimerRef = useRef(null);
  const clickTimeoutRef = useRef(null);
  const lastClickedIndexRef = useRef(null);
  const ignoreClickRef = useRef(false);

  const handlePlayerTouchStart = (index) => { 
    ignoreClickRef.current = false;
    playerTimerRef.current = setTimeout(() => { 
      if (winType === '론') { 
        setLoser(index); 
        if (winner === index) setWinner(null); 
        ignoreClickRef.current = true; // 💡 꾹 누르기(롱프레스)가 발동되면 이어지는 클릭은 무시
      } 
    }, 500); 
  };
  const handlePlayerTouchEnd = () => { 
    if (playerTimerRef.current) clearTimeout(playerTimerRef.current); 
  };

  const handlePlayerClick = (index) => {
    if (ignoreClickRef.current) { ignoreClickRef.current = false; return; }

    if (clickTimeoutRef.current && lastClickedIndexRef.current === index) {
      // 💡 0.25초 안에 같은 사람을 또 눌렀을 때 (더블 클릭 -> 방총자 지정)
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      lastClickedIndexRef.current = null;
      if (winType === '론') { 
        setLoser(index); 
        if (winner === index) setWinner(null); 
      }
    } else {
      // 💡 첫 번째 클릭일 때 (0.25초 대기 후 화료자 확정)
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
      lastClickedIndexRef.current = index;
      clickTimeoutRef.current = setTimeout(() => {
        setWinner(index); 
        if (loser === index) setLoser(null);
        clickTimeoutRef.current = null;
        lastClickedIndexRef.current = null;
      }, 250); // 250ms 대기
    }
  };
  const handleWinTypeChange = (type) => { setWinType(type); if (type === '쯔모') setLoser(null); };const yakuTimerRef = useRef(null);
  const toggleYaku = (yaku) => setSelectedYaku(prev => prev.includes(yaku) ? prev.filter(y => y !== yaku) : [...prev, yaku]);
  const toggleFuroDecrease = (yaku) => { setFuroDecreased(prev => prev.includes(yaku) ? prev.filter(y => y !== yaku) : [...prev, yaku]); setSelectedYaku(prev => prev.includes(yaku) ? prev : [...prev, yaku]); };
  const handleYakuTouchStart = (yaku) => { if (!targetFuroYaku.includes(yaku)) return; yakuTimerRef.current = setTimeout(() => toggleFuroDecrease(yaku), 500); };
  const handleYakuTouchEnd = () => { if (yakuTimerRef.current) clearTimeout(yakuTimerRef.current); };
  const handleYakuDoubleClick = (yaku) => { if (!targetFuroYaku.includes(yaku)) return; toggleFuroDecrease(yaku); };
  const toggleTenpai = (index) => { setTenpaiPlayers(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]); setAbortiveType(null); };
  const toggleNagashi = (index) => setNagashiMangan(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]);
  const toggleAbortive = (type) => { setAbortiveType(prev => prev === type ? null : type); if (abortiveType !== type) setTenpaiPlayers([]); };

  const handleCreateNewGame = async () => {
    const gameType = activeTab === '전체' ? '4인' : activeTab;
    if (gameType === '4인' && (!playerE || !playerS || !playerW || !playerN)) return alert("모든 플레이어 이름을 입력해주세요!");
    if (gameType === '3인' && (!playerE || !playerS || !playerW)) return alert("모든 플레이어 이름을 입력해주세요!");
    
    // 💡 1. 오늘 날짜를 구해서 YYYY-MM-DD 형태로 변환
    const today = new Date();
    const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    
    // 💡 2. 시즌 목록을 돌면서 오늘 날짜가 포함되는 시즌 찾기
    let matchedSeasonId = null;
    for (let i = seasons.length - 1; i >= 0; i--) {
      const s = seasons[i];
      if (s.startDate && s.endDate && todayStr >= s.startDate && todayStr <= s.endDate) {
        matchedSeasonId = s.id;
        break;
      }
    }
    
    // 💡 3. 예외 처리: 오늘 날짜가 속한 시즌이 없다면 "프리 시즌"으로 자동 배정
    if (!matchedSeasonId) {
      const preSeason = seasons.find(s => s.name === "프리 시즌");
      if (preSeason) {
        matchedSeasonId = preSeason.id; // 프리 시즌이 존재하면 프리 시즌으로 쏙!
      } else {
        // 혹시 아직 관리자가 '프리 시즌'을 안 만들어뒀을 때 에러가 나지 않도록 방어 (가장 최근 시즌 배정)
        matchedSeasonId = seasons[seasons.length - 1].id;
      }
    }

    const newGame = { 
      id: Date.now(), 
      seasonId: matchedSeasonId, // 찾은 시즌 ID를 자동 부여
      date: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\./g, '.').slice(0, -1), 
      type: gameType, 
      players: gameType === '4인' ? [playerE, playerS, playerW, playerN] : [playerE, playerS, playerW], 
      rounds: [], status: '진행중', finalResults: null 
    };
    
    await setDoc(doc(db, 'games', newGame.id.toString()), newGame);
    setIsNewGameModalOpen(false); setSelectedGameId(newGame.id); setActiveNav('기록'); 
    setPlayerE(''); setPlayerS(''); setPlayerW(''); setPlayerN('');
  };

  const handleOpenNewRound = () => {
    setEditingRoundId(null);
    setRecordMode('화료'); setWind('동'); setRoundNum(1); setHonba(0); setKyotaku(0);
    setWinType('쯔모'); setWinner(null); setLoser(null); setWaitType('양면'); setMenzen('멘젠');
    setDora(0); setAka(0); setUra(0); setPei(0); setFu(30); setHan(1); setScore('');
    setSelectedYaku([]); setFuroDecreased([]); setTenpaiPlayers([]); setNagashiMangan([]);
    setAbortiveType(null); setRoundComment(''); setChomboPlayer(null); 
    setIsRoundModalOpen(true);
  };

  const handleEditRound = (record) => {
    setEditingRoundId(record.id);
    setRecordMode(record.type); setWind(record.wind); setRoundNum(record.roundNum); setHonba(record.honba); setKyotaku(record.kyotaku);
    if (record.type === '화료') {
      setWinType(record.winType); setWinner(players.indexOf(record.winner)); 
      setLoser(record.loser ? players.indexOf(record.loser) : null);
      setWaitType(record.waitType); setMenzen(record.menzen);
      setDora(record.dora); setAka(record.aka); setUra(record.ura); setPei(record.pei);
      setFu(record.fu); setHan(record.han); setScore(record.score || '');
      setSelectedYaku(record.selectedYaku || []); setFuroDecreased(record.furoDecreased || []);
    } else if (record.type === '유국') {
      setTenpaiPlayers(record.tenpaiPlayers.map(p => players.indexOf(p)));
      setNagashiMangan(record.nagashiMangan ? record.nagashiMangan.map(p => players.indexOf(p)) : []);
      setAbortiveType(record.abortiveType);
    } else if (record.type === '촌보') {
      setChomboPlayer(players.indexOf(record.chomboPlayer));
    }
    setRoundComment(record.comment || '');
    setIsRoundModalOpen(true);
  };

  const handleSaveRound = async () => {
    let newRound = { id: editingRoundId || Date.now(), wind, roundNum, honba, kyotaku, type: recordMode, comment: roundComment };
    if (recordMode === '화료') {
      if (winner === null) return alert("화료자를 선택해주세요!");
      if (winType === '론' && loser === null) return alert("방총자를 선택해주세요!");
      newRound = { ...newRound, winType, menzen, waitType, winner: players[winner], loser: loser !== null ? players[loser] : null, selectedYaku, furoDecreased, dora, aka, ura, pei, fu, han, score };
    } else if (recordMode === '유국') {
      newRound = { ...newRound, tenpaiPlayers: tenpaiPlayers.map(i => players[i]), nagashiMangan: nagashiMangan.map(i => players[i]), abortiveType };
    } else if (recordMode === '촌보') {
      if (chomboPlayer === null) return alert("촌보 발생자를 선택해주세요!");
      newRound = { ...newRound, chomboPlayer: players[chomboPlayer] };
    }
    
    // 수정 모드일 땐 기존 아이디를 찾아 덮어씌우고, 아닐 땐 맨 앞에 추가
    const updatedRounds = editingRoundId 
      ? currentGame.rounds.map(r => r.id === editingRoundId ? newRound : r)
      : [newRound, ...currentGame.rounds];

    await setDoc(doc(db, 'games', selectedGameId.toString()), { ...currentGame, rounds: updatedRounds });
    
    setIsRoundModalOpen(false); setEditingRoundId(null);
    setWinner(null); setLoser(null); setSelectedYaku([]); setFuroDecreased([]); setDora(0); setAka(0); setUra(0); setPei(0); setTenpaiPlayers([]); setNagashiMangan([]); setAbortiveType(null); setRoundComment(''); setScore(''); setChomboPlayer(null); setChomboType('만관 지불');
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

  const hasYakuman = (game) => {
    if(!game.rounds) return false;
    return game.rounds.some(r => r.type === '화료' && (r.han >= 13 || r.selectedYaku?.some(y => yakuData['역만']?.includes(y) || yakuData['더블역만']?.includes(y))));
  };


  // ==========================================
  // 📊 통계 및 랭킹 데이터 처리 로직
  // ==========================================
  const [statsMainTab, setStatsMainTab] = useState('전체'); 
  const [statsSubTab, setStatsSubTab] = useState('플레이어'); 
  const [rankingMainTab, setRankingMainTab] = useState('전체'); 
  const [rankingSort, setRankingSort] = useState('totalUma');
  const [selectedStatPlayerName, setSelectedStatPlayerName] = useState(null); 
  
  // 💡 세부 분포 모달 상태
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
            name: p, gamesPlayed: 0, totalUma: 0, totalScore: 0, maxScore: -99999, minScore: 99999,
            ranks: [0,0,0,0], tobiCount: 0, roundsPlayed: 0, winCount: 0, dealInCount: 0, 
            tsumoCount: 0, ronCount: 0, riichiWinCount: 0, damaWinCount: 0, furoWinCount: 0,
            totalHan: 0, maxHonba: 0, waitTypes: {}, yakus: {},
            totalWinScore: 0, winScoreCount: 0, 
            totalDealInScore: 0, dealInScoreCount: 0, 
            chomboCount: 0, yakumanCount: 0,
            menzenTsumo: 0, menzenRon: 0, furoTsumo: 0, furoRon: 0
          };
        }
        stats[p].gamesPlayed += 1; stats[p].totalUma += res.pt; stats[p].totalScore += res.score; stats[p].ranks[rank] += 1;
        if (res.score > stats[p].maxScore) stats[p].maxScore = res.score;
        if (res.score < stats[p].minScore) stats[p].minScore = res.score;
        if (res.score < 0) stats[p].tobiCount += 1;
      });

      game.rounds.forEach(round => {
        game.players.forEach(p => { if (stats[p]) stats[p].roundsPlayed += 1; });
        if(round.type === '화료') {
          const winnerStat = stats[round.winner];
          if(winnerStat) {
            winnerStat.winCount += 1; winnerStat.totalHan += round.han;
            if (round.honba > winnerStat.maxHonba) winnerStat.maxHonba = round.honba;
            
            const isMenzen = round.menzen === '멘젠';
            if (round.winType === '쯔모') { winnerStat.tsumoCount += 1; isMenzen ? winnerStat.menzenTsumo++ : winnerStat.furoTsumo++; }
            if (round.winType === '론') { winnerStat.ronCount += 1; isMenzen ? winnerStat.menzenRon++ : winnerStat.furoRon++; }
            
            const isRiichi = round.selectedYaku?.includes('리치') || round.selectedYaku?.includes('더블리치');
            if (!isMenzen) winnerStat.furoWinCount += 1;
            else if (isRiichi) winnerStat.riichiWinCount += 1;
            else winnerStat.damaWinCount += 1;

            if (round.han >= 13 || round.selectedYaku?.some(y => yakuData['역만']?.includes(y) || yakuData['더블역만']?.includes(y))) winnerStat.yakumanCount += 1;

            winnerStat.waitTypes[round.waitType] = (winnerStat.waitTypes[round.waitType] || 0) + 1;
            round.selectedYaku?.forEach(yaku => { winnerStat.yakus[yaku] = (winnerStat.yakus[yaku] || 0) + 1; });
            
            // 평균 타점용 합산
            if (round.score && Number(round.score) > 0) {
              winnerStat.totalWinScore += Number(round.score);
              winnerStat.winScoreCount += 1;
            }
          }
          if(round.winType === '론' && round.loser && stats[round.loser]) {
            stats[round.loser].dealInCount += 1;
            // 평균 방총점용 합산
            if (round.score && Number(round.score) > 0) {
              stats[round.loser].totalDealInScore += Number(round.score);
              stats[round.loser].dealInScoreCount += 1;
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
        winRate: s.roundsPlayed > 0 ? ((s.winCount / s.roundsPlayed) * 100).toFixed(1) : 0,
        dealInRate: s.roundsPlayed > 0 ? ((s.dealInCount / s.roundsPlayed) * 100).toFixed(1) : 0,
        avgHan: s.winCount > 0 ? (s.totalHan / s.winCount).toFixed(1) : 0,
        avgWinScore: s.winScoreCount > 0 ? Math.floor(s.totalWinScore / s.winScoreCount) : 0,
        avgUma: s.gamesPlayed > 0 ? (s.totalUma / s.gamesPlayed).toFixed(1) : 0,
        avgScore: s.gamesPlayed > 0 ? Math.floor(s.totalScore / s.gamesPlayed) : 0,
        avgDealInScore: s.dealInScoreCount > 0 ? Math.floor(s.totalDealInScore / s.dealInScoreCount) : 0,
        firstRate: s.gamesPlayed > 0 ? ((s.ranks[0] / s.gamesPlayed) * 100).toFixed(1) : 0,
        rentaiRate: s.gamesPlayed > 0 ? ((rentaiCount / s.gamesPlayed) * 100).toFixed(1) : 0,
        tobiRate: s.gamesPlayed > 0 ? ((s.tobiCount / s.gamesPlayed) * 100).toFixed(1) : 0,
        avgRank: avgRank,
        topYakus: Object.entries(s.yakus).sort((a,b) => b[1] - a[1]).slice(0, 5)
      };
    });
  };

  const statsGames = getFilteredGamesForStats(statsMainTab);
  const playerStatsList = useMemo(() => generatePlayerStats(statsGames).sort((a,b) => b.winCount - a.winCount), [statsGames]);
  const selectedStatPlayer = playerStatsList.find(p => p.name === selectedStatPlayerName);

  // 💡 모달 데이터 생성 헬퍼 함수
  const openBreakdown = (title, type, key) => {
    const data = playerStatsList.map(p => {
      let count = 0;
      if (type === 'yaku') count = p.yakus[key] || 0;
      else if (type === 'wait') count = p.waitTypes[key] || 0;
      else if (type === 'winType') count = p[key] || 0;
      return { name: p.name, count };
    }).filter(p => p.count > 0).sort((a, b) => b.count - a.count);
    setBreakdownData({ title, data });
  };

  const globalYakuStats = useMemo(() => {
    const yCounts = {};
    statsGames.forEach(g => g.rounds.forEach(r => { if(r.type === '화료') r.selectedYaku?.forEach(y => yCounts[y] = (yCounts[y] || 0) + 1); }));
    return Object.entries(yCounts).sort((a,b) => b[1] - a[1]);
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

  const rankingList = useMemo(() => {
    const list = generatePlayerStats(getFilteredGamesForStats(rankingMainTab));
    const sorted = list.sort((a, b) => {
      let diff = 0;
      if (rankingSort === 'totalUma') diff = b.totalUma - a.totalUma;
      else if (rankingSort === 'avgUma') diff = b.avgUma - a.avgUma;
      else if (rankingSort === 'maxScore') diff = b.maxScore - a.maxScore;
      else if (rankingSort === 'minScore') diff = a.minScore - b.minScore; 
      else if (rankingSort === 'gameCount') diff = b.gamesPlayed - a.gamesPlayed;
      else if (rankingSort === 'firstRate') diff = parseFloat(b.firstRate) - parseFloat(a.firstRate);
      else if (rankingSort === 'rentaiRate') diff = parseFloat(b.rentaiRate) - parseFloat(a.rentaiRate);
      else if (rankingSort === 'tobiRate') diff = parseFloat(a.tobiRate) - parseFloat(b.tobiRate); 
      
      // 💡 동점 시 가나다순 정렬
      if (diff === 0) return a.name.localeCompare(b.name);
      return diff;
    });

    // 💡 공동 순위 로직 (1, 2, 2, 4...)
    let currentRank = 1;
    return sorted.map((player, index, arr) => {
      if (index > 0) {
        const prev = arr[index - 1];
        let isTie = false;
        if (rankingSort === 'totalUma') isTie = player.totalUma === prev.totalUma;
        else if (rankingSort === 'avgUma') isTie = player.avgUma === prev.avgUma;
        else if (rankingSort === 'maxScore') isTie = player.maxScore === prev.maxScore;
        else if (rankingSort === 'minScore') isTie = player.minScore === prev.minScore;
        else if (rankingSort === 'gameCount') isTie = player.gamesPlayed === prev.gamesPlayed;
        else if (rankingSort === 'firstRate') isTie = player.firstRate === prev.firstRate;
        else if (rankingSort === 'rentaiRate') isTie = player.rentaiRate === prev.rentaiRate;
        else if (rankingSort === 'tobiRate') isTie = player.tobiRate === prev.tobiRate;
        if (!isTie) currentRank = index + 1;
      }
      return { ...player, rank: currentRank };
    });
  }, [games, rankingMainTab, rankingSort, selectedSeason]);


  if (isLoading) return <div className="h-screen w-full flex items-center justify-center bg-[#F5F5DC] text-[#2E7D32] font-bold">서버 연결 중...</div>;

  return (
    <div className="flex flex-col h-screen bg-[#F5F5DC] font-sans relative overflow-hidden text-[#1A1A1A]">
      
      {/* 💡 전체 영역이 스크롤되도록 main 태그로 헤더부터 감쌉니다 */}
      <main className="flex-1 overflow-y-auto flex flex-col relative pb-24">
        
      {/* 🚀 상단 헤더 */}
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

      {/* 상단 탭 (기록 화면 메인에서만 노출) */}
      {activeNav === '기록' && selectedGameId === null && (
        <div className="flex bg-white border-b border-gray-200 shadow-sm z-10 shrink-0">
          {['전체', '4인', '3인'].map(t => (
            <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-3 text-center font-bold flex justify-center items-center gap-1.5 border-b-2 ${activeTab === t ? 'border-[#2E7D32] text-[#2E7D32]' : 'border-transparent text-gray-500'}`}>
              {t} 게임 <span className={`text-[10px] px-2 py-0.5 rounded-full text-white ${activeTab === t ? 'bg-[#2E7D32]' : 'bg-gray-300'}`}>{t === '전체' ? games.length : games.filter(g=>g.type===t).length}</span>
            </button>
          ))}
        </div>
      )}

      {/* 🔍 검색창 (기록 메인) */}
      {activeNav === '기록' && selectedGameId === null && (
        <div className="p-4 pb-0 bg-[#F5F5DC] shrink-0">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search size={16} className="text-gray-400" /></div>
            <input type="text" placeholder="플레이어 이름 또는 날짜 검색..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-[#2E7D32] shadow-sm" />
          </div>
        </div>
      )}

      {/* <main className="flex-1 overflow-y-auto flex flex-col relative pb-24"> */}
        
        {/* ========================================= */}
        {/* 화면 1: 대국 기록 메인 리스트 */}
        {/* ========================================= */}
        {activeNav === '기록' && selectedGameId === null && (
          <div className="flex-1 flex flex-col p-4 space-y-4">
            {displayedGames.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center mt-20 text-gray-400 text-center">
                <Gamepad2 size={64} strokeWidth={1} className="mb-4 text-gray-300" />
                <h2 className="text-lg font-bold mb-2">검색된 대국 기록이 없습니다</h2>
                {canWrite ? (
                  <p className="text-xs">우측 하단 + 버튼으로 새 대국을 만드세요</p>
                ) : currentUser ? (
                  <p className="text-xs font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">쓰기 권한 승인 대기 중입니다 (마스터 문의)</p>
                ) : (
                  <p className="text-xs">우측 상단 로그인 후 기록을 추가할 수 있습니다</p>
                )}
              </div>
            ) : (
              displayedGames.map(game => {
                const isYakuman = hasYakuman(game);
                return (
                  <div key={game.id} onClick={() => setSelectedGameId(game.id)} className={`bg-white p-4 rounded-[20px] shadow-sm relative cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98] ${isYakuman ? 'border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'border border-gray-100'}`}>
                    {isYakuman && <span className="absolute -top-3 -right-2 bg-gradient-to-r from-red-500 to-yellow-500 text-white text-[10px] font-black px-2 py-1 rounded-full shadow-md animate-pulse">역만 대국🔥</span>}
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-gray-400 font-medium">{game.date}</span>
                        <div className="flex items-center gap-1.5"><span className={`text-[10px] font-bold px-2 py-1 rounded ${game.status === '종료' ? 'text-gray-600 bg-gray-100' : 'text-[#2E7D32] bg-green-50'}`}>{game.rounds.length}국</span><span className={`text-[10px] font-bold px-2 py-1 rounded ${game.status === '종료' ? 'text-gray-500 bg-gray-200' : 'text-[#2E7D32] bg-green-50'}`}>{game.status}</span></div>
                    </div>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-bold text-base text-gray-800 truncate pr-4 tracking-tight">{game.players.join(' · ')}</h3>
                      {canWrite && <button onClick={(e) => handleDeleteGame(e, game.id)} className="text-red-300 hover:text-red-500 p-1"><Trash2 size={16} /></button>}
                    </div>
                    {game.status === '종료' && game.finalResults ? (
                      <div className={`grid gap-2 mt-2 ${game.type === '4인' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {game.players.map((p, i) => (
                          <div key={i} className="flex items-center justify-between bg-white p-2 rounded-xl shadow-sm border border-gray-100">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className="bg-[#2E7D32] text-white w-8 h-8 min-w-[32px] rounded-lg flex items-center justify-center font-bold text-sm shadow-inner">
                                {['동','남','서','북'][i]}
                              </div>
                              <span className="text-sm font-bold text-gray-800 truncate">{p}</span>
                            </div>
                            <div className="flex flex-col items-end pr-1">
                              <span className={`text-sm font-black ${game.finalResults[i].pt > 0 ? 'text-[#2E7D32]' : game.finalResults[i].pt < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                                {game.finalResults[i].pt > 0 ? '+' : ''}{game.finalResults[i].pt}
                              </span>
                              <span className="text-[11px] font-bold text-gray-400 mt-0.5">
                                {Number(game.finalResults[i].score).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={`grid gap-2 mt-2 ${game.type === '4인' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {game.players.map((p, i) => (
                          <div key={i} className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-gray-100">
                            <div className="bg-[#2E7D32] text-white w-8 h-8 min-w-[32px] rounded-lg flex items-center justify-center font-bold text-sm shadow-inner">
                              {['동','남','서','북'][i]}
                            </div>
                            <span className="text-sm font-bold text-gray-700 truncate">{p}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            {canWrite && activeTab !== '전체' && (
              <div className="fixed bottom-20 right-6 z-20">
                <button onClick={() => setIsNewGameModalOpen(true)} className="bg-[#2E7D32] text-white p-4 rounded-full shadow-lg hover:bg-green-800 active:scale-95 transition-transform">
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
                records.map(record => (
                  <div key={record.id} className={`rounded-xl shadow-sm border relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 ${record.type === '촌보' ? 'bg-red-50 border-red-200' : record.type === '유국' ? 'bg-gray-50 border-gray-300' : 'bg-white border-gray-100'}`}>
                    
                    {/* 💡 카드 타이틀 (헤더) 영역 추가 */}
                    <div className={`px-3 py-2 border-b flex justify-between items-center ${record.type === '촌보' ? 'bg-red-100 border-red-200' : record.type === '유국' ? 'bg-gray-200 border-gray-300' : 'bg-gray-100 border-gray-200'}`}>
                      <span className={`font-bold text-sm ${record.type === '촌보' ? 'text-red-800' : 'text-gray-700'}`}>
                        {record.wind}{record.roundNum}국 {record.honba > 0 && `${record.honba}본장`}
                        {record.type === '유국' && ' (유국)'}
                        {record.type === '촌보' && ' (촌보)'}
                      </span>
                      {canWrite && (
                        <div className="flex items-center gap-2">
                          {/* 💡 연필 아이콘 추가 */}
                          <button onClick={() => handleEditRound(record)} className="text-gray-400 hover:text-blue-500 transition-colors"><Edit size={14} /></button>
                          <button onClick={() => handleDeleteRound(record.id)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                        </div>
                      )}
                    </div>

                    {/* 💡 카드 본문 영역 */}
                    <div className="p-3 pt-2.5">
                      {record.type === '화료' ? (
                        <>
                          <div className="flex items-center gap-2 mb-2"><span className={`font-bold text-[11px] ${record.winType === '쯔모' ? 'text-[#2E7D32]' : 'text-orange-500'}`}>{record.winType}</span><span className="font-bold text-sm text-gray-800">{record.winner} {record.winType === '론' && <span className="text-gray-400 text-xs font-medium mx-1">← {record.loser}</span>}</span>{record.score && <span className="ml-auto font-black text-[#2E7D32] text-xs">{Number(record.score).toLocaleString()}점</span>}</div>
                          <div className="flex flex-wrap gap-1 mb-1.5"><span className="bg-gray-100 text-gray-600 text-[9px] px-1.5 py-0.5 rounded font-bold">{record.waitType}</span><span className="bg-gray-100 text-gray-600 text-[9px] px-1.5 py-0.5 rounded font-bold">{record.menzen}</span>{record.selectedYaku?.map(yaku => <span key={yaku} className="bg-green-50 text-green-700 text-[9px] px-1.5 py-0.5 rounded font-bold border border-green-100">{yaku} {record.furoDecreased.includes(yaku) && '(-1판)'}</span>)}{(record.dora + record.aka + record.ura + record.pei) > 0 && (<span className="bg-amber-50 text-amber-600 text-[9px] px-1.5 py-0.5 rounded font-bold border border-amber-200">도라 {record.dora + record.aka + record.ura + record.pei}</span>)}</div>
                          <div className="text-[10px] text-gray-400 font-bold mt-1">{record.han}판 {record.fu}부</div>
                        </>
                      ) : record.type === '유국' ? (
                        <div className="space-y-1.5"><div className="flex items-center gap-1.5"><ShieldAlert size={14} className="text-gray-500" /><span className="font-bold text-gray-800 text-sm">{record.abortiveType ? `도중유국 (${record.abortiveType})` : '황패유국'}</span></div>{!record.abortiveType && (<div className="text-[11px] font-bold text-gray-600 pl-5 space-y-0.5"><p className="text-gray-500">텐파이: <span className="text-gray-800">{record.tenpaiPlayers.length > 0 ? record.tenpaiPlayers.join(', ') : '전원 노텐'}</span></p>{record.nagashiMangan?.length > 0 && (<p className="text-gray-500 mt-1">유국만관: {record.nagashiMangan.map(p => <span key={p} className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded ml-1">{p}</span>)}</p>)}</div>)}</div>
                      ) : (
                        <div className="space-y-1"><div className="flex items-center gap-1.5"><AlertOctagon size={14} className="text-red-500" /><span className="font-bold text-red-700 text-sm">{record.chomboPlayer} 촌보</span></div></div>
                      )}
                      {record.comment && (<div className="mt-2 pt-2 border-t border-gray-100 border-opacity-50 text-[10px] text-gray-500 font-medium flex gap-1"><MessageSquare size={12} className="mt-0.5" /> {record.comment}</div>)}
                    </div>
                  </div>
                ))
              )}
            </div>
            {currentGame.status === '진행중' && canWrite && (
              <div className="fixed bottom-20 right-6 z-20">
                {/* 💡 버튼을 눌렀을 때 초기화 함수 호출로 변경 */}
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
                  {playerStatsList.length === 0 ? (
                    <div className="text-center py-20 text-gray-400 font-bold">아직 종료된 대국이 없습니다.</div>
                  ) : (
                    playerStatsList.map(stat => (
                      <div key={stat.name} onClick={() => setSelectedStatPlayerName(stat.name)} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition-all active:scale-[0.98]">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                          <div>
                            <h3 className="font-bold text-xl text-gray-800">{stat.name}</h3>
                            <span className="text-xs text-gray-500 font-bold mt-1 inline-block">{stat.gamesPlayed}국 </span>
                          </div>
                          <div className="bg-green-50 p-3 rounded-xl border border-green-100 text-center min-w-[80px]">
                            <span className="block text-[10px] text-gray-500 font-bold mb-0.5">현재 우마</span>
                            <span className={`text-xl font-black ${stat.totalUma > 0 ? 'text-[#2E7D32]' : stat.totalUma < 0 ? 'text-red-500' : 'text-gray-700'}`}>{stat.totalUma > 0 ? '+' : ''}{stat.totalUma.toFixed(1)}</span>
                          </div>
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
                      {globalYakuStats.map(([yaku, count], i) => {
                        const maxCount = globalYakuStats[0][1];
                        const percent = (count / maxCount) * 100;
                        return (
                          <div key={yaku} onClick={() => openBreakdown(`${yaku} 출현 분포`, 'yaku', yaku)} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-1.5 -mx-1.5 rounded transition-colors active:scale-[0.98]">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white ${i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-amber-600' : 'bg-gray-200 text-gray-500'}`}>{i + 1}</div>
                            <span className="w-24 text-sm font-bold text-gray-700 truncate">{yaku}</span>
                            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden relative"><div className="h-full bg-green-500 rounded-full" style={{ width: `${percent}%` }}></div></div>
                            <span className="w-8 text-right text-sm font-black text-[#2E7D32]">{count}회</span>
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
        {/* 화면 3: 🏆 전체 랭킹 페이지 */}
        {/* ========================================= */}
        {activeNav === '랭킹' && (
          <div className="flex-1 flex flex-col bg-[#F5F5DC]">
            <div className="flex bg-white border-b border-gray-200 shadow-sm z-10 shrink-0 text-sm">
              {['전체', '4인', '3인'].map(t => (
                <button key={t} onClick={() => setRankingMainTab(t)} className={`flex-1 py-3 font-bold ${rankingMainTab === t ? 'bg-[#2E7D32] text-white' : 'text-gray-500 bg-gray-50 border-b-2 border-gray-200 hover:bg-gray-100'}`}>{t} 순위</button>
              ))}
            </div>
            
            <div className="p-4 space-y-4">
              <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 flex items-center gap-1"><BarChart2 size={14}/> 정렬 기준</span>
                <select value={rankingSort} onChange={e=>setRankingSort(e.target.value)} className="bg-gray-50 border border-gray-200 text-gray-800 text-sm font-bold rounded-lg px-2 py-1.5 focus:outline-none">
                  <option value="totalUma">누적 우마</option>
                  <option value="avgUma">평균 우마</option>
                  <option value="maxScore">최고 점수</option>
                  <option value="firstRate">1위율 (%)</option>
                  <option value="rentaiRate">연대율 (%)</option>
                  <option value="tobiRate">들통율 (%)</option>
                  <option value="gameCount">대국 수</option>
                </select>
              </div>

              {rankingList.length === 0 ? (
                <div className="text-center py-20 text-gray-400 font-bold bg-white rounded-2xl shadow-sm border border-gray-100"><Trophy size={48} className="mx-auto mb-4 text-gray-300" /><p>아직 종료된 대국이 없어</p><p>순위를 매길 수 없습니다.</p></div>
              ) : (
                <div className="space-y-3">
                  {rankingList.map((player) => {
                    let highlightText = ''; let highlightLabel = '';
                    if(rankingSort === 'totalUma') { highlightText = (player.totalUma>0?'+':'')+player.totalUma.toFixed(1); highlightLabel = '우마 합'; }
                    if(rankingSort === 'avgUma') { highlightText = (player.avgUma>0?'+':'')+player.avgUma; highlightLabel = '평균 우마'; }
                    if(rankingSort === 'maxScore') { highlightText = Number(player.maxScore).toLocaleString(); highlightLabel = '최고 점수'; }
                    if(rankingSort === 'firstRate') { highlightText = player.firstRate+'%'; highlightLabel = '1위율'; }
                    if(rankingSort === 'rentaiRate') { highlightText = player.rentaiRate+'%'; highlightLabel = '연대율'; }
                    if(rankingSort === 'tobiRate') { highlightText = player.tobiRate+'%'; highlightLabel = '들통율'; }
                    if(rankingSort === 'gameCount') { highlightText = player.gamesPlayed+'국'; highlightLabel = '대국 수'; }

                    return (
                      <div key={player.name} className="bg-white p-4 rounded-[20px] shadow-sm border border-gray-100 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-white shadow-inner text-lg ${player.rank === 1 ? 'bg-yellow-400' : player.rank === 2 ? 'bg-gray-400' : player.rank === 3 ? 'bg-amber-600' : 'bg-gray-200 text-gray-600'}`}>{player.rank}</div>
                          <div>
                            <h3 className="font-bold text-base text-gray-800 leading-tight">{player.name}</h3>
                            <div className="text-[10px] text-gray-500 font-bold mt-1 flex gap-1.5 items-center">
                              <span className="bg-gray-100 px-1.5 py-0.5 rounded">{player.gamesPlayed}국</span>
                              {/* <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded">1위 {player.firstRate}%</span>
                              <span className="bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded">연대 {player.rentaiRate}%</span> */}
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <div className={`text-lg font-black tracking-tighter ${rankingSort==='totalUma'||rankingSort==='avgUma' ? (parseFloat(highlightText)>0?'text-[#2E7D32]':parseFloat(highlightText)<0?'text-red-500':'text-gray-500') : 'text-gray-800'}`}>{highlightText}</div>
                          <div className="text-[9px] text-gray-400 font-bold mt-0.5">{highlightLabel}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================= */}
        {/* 화면 4: 📢 업데이트 내역 페이지 */}
        {/* ========================================= */}
        {activeNav === '업데이트' && (
          <div className="flex-1 flex flex-col p-4 space-y-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                <span className="font-black text-[#2E7D32] text-xl">v1.0.0</span>
                <span className="text-sm font-bold text-gray-400">2026/03/05</span>
              </div>
              <ul className="text-sm font-bold text-gray-700 space-y-2 pl-2 list-disc list-inside">
                <li>리치 마작 기록 및 통계 페이지 오픈</li>
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
                breakdownData.data.map((item, idx) => {
                  const maxCount = breakdownData.data[0].count;
                  const pct = (item.count / maxCount) * 100;
                  return (
                    <div key={item.name} className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white ${idx === 0 ? 'bg-yellow-400' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-amber-600' : 'bg-gray-200 text-gray-500'}`}>{idx + 1}</div>
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
      {/* 👤 개인 통계 상세 모달 (Player Detail) */}
      {/* ========================================= */}
      {selectedStatPlayer && (
        <div className="absolute inset-0 bg-black bg-opacity-70 z-[90] flex flex-col justify-end animate-in fade-in">
          <div className="bg-[#F5F5DC] w-full h-[90%] rounded-t-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom">
            <div className="bg-[#1e293b] rounded-t-3xl p-4 flex justify-between items-center text-white">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2"><PieChart size={20}/> {selectedStatPlayer.name}</h2>
                <select value={selectedSeason} onChange={(e) => setSelectedSeason(e.target.value)} className="bg-gray-700 text-white text-[10px] font-bold py-1 px-2 mt-1 rounded appearance-none focus:outline-none">
                  <option value="all">전체 시즌</option>
                  {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <button onClick={() => setSelectedStatPlayerName(null)} className="p-1.5 hover:bg-gray-700 rounded-full transition-colors bg-gray-800"><X size={20}/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 text-center"><span className="block text-[10px] text-gray-500 font-bold mb-1">대국 수</span><span className="text-xl font-black text-gray-800">{selectedStatPlayer.gamesPlayed}국</span></div>
                <div className="bg-green-50 p-3 rounded-xl shadow-sm border border-green-200 text-center"><span className="block text-[10px] text-green-700 font-bold mb-1">현재 우마</span><span className={`text-xl font-black ${selectedStatPlayer.totalUma > 0 ? 'text-[#2E7D32]' : selectedStatPlayer.totalUma < 0 ? 'text-red-500' : 'text-gray-800'}`}>{selectedStatPlayer.totalUma > 0 ? '+' : ''}{selectedStatPlayer.totalUma.toFixed(1)}</span></div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5"><BarChart size={16}/> 상세 통계</h3>
                <div className="grid grid-cols-4 gap-2 text-center text-sm font-medium mb-3">
                  <div className="flex flex-col gap-1"><span className="text-[10px] text-gray-500 font-bold">화료수</span><span className="font-black text-[#2E7D32]">{selectedStatPlayer.winCount}회</span></div>
                  <div className="flex flex-col gap-1"><span className="text-[10px] text-gray-500 font-bold">방총수</span><span className="font-black text-orange-500">{selectedStatPlayer.dealInCount}회</span></div>
                  <div className="flex flex-col gap-1"><span className="text-[10px] text-gray-500 font-bold">역만수</span><span className="font-black text-red-600">{selectedStatPlayer.yakumanCount}회</span></div>
                  <div className="flex flex-col gap-1"><span className="text-[10px] text-gray-500 font-bold">쵼보수</span><span className="font-black text-purple-600">{selectedStatPlayer.chomboCount}회</span></div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-sm font-medium mb-3 bg-gray-50 p-2 rounded-lg">
                  {[1, 2, 3, 4].map(rank => {
                    const count = selectedStatPlayer.ranks[rank-1];
                    const pct = selectedStatPlayer.gamesPlayed > 0 ? ((count / selectedStatPlayer.gamesPlayed) * 100).toFixed(0) : 0;
                    return (
                      <div key={rank} className="flex flex-col gap-0.5"><span className="text-[10px] font-bold text-gray-600">{rank}등수</span><span className="font-black text-gray-800">{count}회</span><span className="text-[9px] text-gray-400">({pct}%)</span></div>
                    )
                  })}
                </div>

                <div className="grid grid-cols-2 gap-2 text-center text-sm font-medium">
                  <div className="flex flex-col gap-1 border border-blue-100 bg-blue-50 py-2 rounded-lg"><span className="text-[10px] text-blue-700 font-bold">연대율</span><span className="font-black text-blue-600 text-base">{selectedStatPlayer.rentaiRate}%</span></div>
                  <div className="flex flex-col gap-1 border border-slate-200 bg-slate-50 py-2 rounded-lg"><span className="text-[10px] text-slate-600 font-bold">들통율 (토비)</span><span className="font-black text-slate-700 text-base">{selectedStatPlayer.tobiCount}회 <span className="text-xs font-medium">({selectedStatPlayer.tobiRate}%)</span></span></div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2"><span className="block text-[9px] text-gray-500 font-bold mb-1">최고 점수</span><span className="text-sm font-black text-gray-800">{selectedStatPlayer.maxScore === -99999 ? '-' : Number(selectedStatPlayer.maxScore).toLocaleString()}</span></div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2"><span className="block text-[9px] text-gray-500 font-bold mb-1">최소 점수</span><span className="text-sm font-black text-gray-800">{selectedStatPlayer.minScore === 99999 ? '-' : Number(selectedStatPlayer.minScore).toLocaleString()}</span></div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2"><span className="block text-[9px] text-gray-500 font-bold mb-1">평균 소점</span><span className="text-sm font-black text-gray-800">{Number(selectedStatPlayer.avgScore).toLocaleString()}</span></div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2"><span className="block text-[9px] text-gray-500 font-bold mb-1">평균 타점</span><span className="text-sm font-black text-[#2E7D32]">{Number(selectedStatPlayer.avgWinScore).toLocaleString()}점</span></div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2"><span className="block text-[9px] text-gray-500 font-bold mb-1">평균 순위</span><span className="text-sm font-black text-amber-600">{selectedStatPlayer.avgRank}위</span></div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2"><span className="block text-[9px] text-gray-500 font-bold mb-1">평균 우마</span><span className="text-sm font-black text-gray-800">{selectedStatPlayer.avgUma}</span></div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2"><span className="block text-[9px] text-gray-500 font-bold mb-1">최대 연장</span><span className="text-sm font-black text-gray-800">{selectedStatPlayer.maxHonba}본장</span></div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2"><span className="block text-[9px] text-gray-500 font-bold mb-1">평균 방총점</span><span className="text-sm font-black text-orange-500">{Number(selectedStatPlayer.avgDealInScore).toLocaleString()}점</span></div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h3 className="text-sm font-bold text-gray-800 mb-3">모든 사용 역 현황</h3>
                {Object.keys(selectedStatPlayer.yakus).length === 0 ? <p className="text-xs text-gray-400">기록된 역이 없습니다.</p> : (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(selectedStatPlayer.yakus).sort((a,b)=>b[1]-a[1]).map(([yaku, count]) => (
                      <span key={yaku} className="bg-green-50 text-green-800 border border-green-200 px-2 py-1 rounded text-[10px] font-bold">{yaku} <span className="text-green-500 ml-0.5">{count}</span></span>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h3 className="text-sm font-bold text-gray-800 mb-3">화료 형태별 비율</h3>
                <div className="grid grid-cols-3 gap-2 mb-4 bg-gray-50 p-2 rounded-lg text-center">
                  <div><span className="block text-[10px] font-bold text-red-600 mb-0.5">리치 화료율</span><span className="text-sm font-black">{selectedStatPlayer.winCount>0?((selectedStatPlayer.riichiWinCount/selectedStatPlayer.winCount)*100).toFixed(0):0}%</span><span className="block text-[9px] text-gray-400">({selectedStatPlayer.riichiWinCount}회)</span></div>
                  <div><span className="block text-[10px] font-bold text-gray-600 mb-0.5">다마 화료율</span><span className="text-sm font-black">{selectedStatPlayer.winCount>0?((selectedStatPlayer.damaWinCount/selectedStatPlayer.winCount)*100).toFixed(0):0}%</span><span className="block text-[9px] text-gray-400">({selectedStatPlayer.damaWinCount}회)</span></div>
                  <div><span className="block text-[10px] font-bold text-blue-600 mb-0.5">후로 화료율</span><span className="text-sm font-black">{selectedStatPlayer.winCount>0?((selectedStatPlayer.furoWinCount/selectedStatPlayer.winCount)*100).toFixed(0):0}%</span><span className="block text-[9px] text-gray-400">({selectedStatPlayer.furoWinCount}회)</span></div>
                </div>
                <div className="space-y-2">
                  {[
                    { label: '멘젠 쯔모', count: selectedStatPlayer.menzenTsumo, color: 'bg-green-500' },
                    { label: '멘젠 론', count: selectedStatPlayer.menzenRon, color: 'bg-[#2E7D32]' },
                    { label: '비멘젠 쯔모', count: selectedStatPlayer.furoTsumo, color: 'bg-blue-400' },
                    { label: '비멘젠 론', count: selectedStatPlayer.furoRon, color: 'bg-orange-400' }
                  ].map(w => {
                    const pct = selectedStatPlayer.winCount > 0 ? ((w.count / selectedStatPlayer.winCount) * 100).toFixed(1) : 0;
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
                    const c = selectedStatPlayer.waitTypes[w] || 0;
                    const pct = selectedStatPlayer.winCount > 0 ? ((c / selectedStatPlayer.winCount) * 100).toFixed(1) : 0;
                    return (
                      <div key={w}>
                        <div className="flex justify-between text-[10px] font-bold text-gray-700 mb-0.5"><span>{w}</span><span>{c}회 ({pct}%)</span></div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-gray-600" style={{width: `${pct}%`}}></div></div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
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
                  {user.pendingAdmin && (
                    <div className="bg-yellow-50 border border-yellow-200 p-2 rounded-lg mb-2 flex items-center justify-between"><span className="text-xs font-bold text-yellow-700">⚠️ 관리자 권한 요청됨</span><div className="flex gap-1"><button onClick={() => handleApproveAdmin(user.name)} className="bg-green-500 text-white p-1 rounded hover:bg-green-600"><UserCheck size={16}/></button><button onClick={() => handleRejectAdmin(user.name)} className="bg-gray-400 text-white p-1 rounded hover:bg-gray-500"><X size={16}/></button></div></div>
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

      {isNewGameModalOpen && (
        <div className="absolute inset-0 bg-black bg-opacity-60 z-50 flex flex-col justify-end animate-in fade-in">
          <div className="bg-[#F5F5DC] w-full h-[80%] rounded-t-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom">
            <div className="bg-[#2E7D32] rounded-t-3xl p-4 flex justify-between items-center text-white"><h2 className="text-lg font-bold">{activeTab} 대국 시작</h2><button onClick={() => setIsNewGameModalOpen(false)} className="p-1 hover:bg-green-700 rounded-full"><X size={20} /></button></div>
            <div className="p-5 flex-1 overflow-y-auto">
              <div className="flex items-center gap-2 mb-4"><Users className="text-[#2E7D32]" /><p className="text-gray-800 font-bold text-sm">초기 좌석을 입력해주세요</p></div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-gray-100"><div className="bg-[#2E7D32] text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shadow-inner">동</div><input type="text" value={playerE} onChange={e => setPlayerE(e.target.value)} placeholder="동가 이름" className="flex-1 text-sm font-bold bg-transparent focus:outline-none" /></div>
                <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-gray-100"><div className="bg-[#2E7D32] text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shadow-inner">남</div><input type="text" value={playerS} onChange={e => setPlayerS(e.target.value)} placeholder="남가 이름" className="flex-1 text-sm font-bold bg-transparent focus:outline-none" /></div>
                <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-gray-100"><div className="bg-[#2E7D32] text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shadow-inner">서</div><input type="text" value={playerW} onChange={e => setPlayerW(e.target.value)} placeholder="서가 이름" className="flex-1 text-sm font-bold bg-transparent focus:outline-none" /></div>
                {activeTab === '4인' && (<div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-gray-100"><div className="bg-[#2E7D32] text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shadow-inner">북</div><input type="text" value={playerN} onChange={e => setPlayerN(e.target.value)} placeholder="북가 이름" className="flex-1 text-sm font-bold bg-transparent focus:outline-none" /></div>)}
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
            {/* 💡 수정 모드일 때는 '기록 수정'으로 표시되도록 제목 변경 */}
            <h2 className="text-xl font-bold">{editingRoundId ? '기록 수정' : `${wind}${roundNum}국 기록`}</h2>
            <button onClick={handleSaveRound} className="text-sm font-bold bg-green-700 px-3 py-1 rounded hover:bg-green-600">저장</button>
          </div>
          <div className="flex bg-white shadow-sm z-10 text-sm"><button onClick={() => setRecordMode('화료')} className={`flex-1 py-4 font-bold border-b-4 transition-colors ${recordMode === '화료' ? 'border-[#2E7D32] text-[#2E7D32]' : 'border-transparent text-gray-400'}`}>화료</button><button onClick={() => setRecordMode('유국')} className={`flex-1 py-4 font-bold border-b-4 transition-colors ${recordMode === '유국' ? 'border-gray-600 text-gray-700' : 'border-transparent text-gray-400'}`}>유국</button><button onClick={() => setRecordMode('촌보')} className={`flex-1 py-4 font-bold border-b-4 transition-colors ${recordMode === '촌보' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-400'}`}>촌보</button></div>
          <div className="flex-1 overflow-y-auto p-4 space-y-8 pb-32">
            <section className="space-y-3">
              {/* 💡 소제목 추가 */}
              <h3 className="font-bold text-base text-gray-800 border-b pb-1">국 / 본장 / 공탁</h3>
              
              {/* 💡 국풍과 국 번호를 2개의 개별 흰색 박스로 분리 (본장/공탁과 동일한 스타일) */}
              <div className="flex flex-wrap gap-3">
                {/* 국풍 박스 ( < > 버튼으로 순환 ) */}
                <div className="flex-1 flex justify-between items-center p-2.5 bg-white rounded-xl border border-gray-100 shadow-sm min-w-[120px]">
                  <span className="font-bold text-green-700 text-sm">국풍</span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => {
                      const winds = ['동', '남', '서', '북'];
                      setWind(prev => winds[(winds.indexOf(prev) - 1 + 4) % 4]);
                    }} className="bg-gray-100 w-8 h-8 rounded font-bold hover:bg-gray-200">-</button>
                    
                    <span className="font-bold text-lg w-4 text-center text-gray-800">{wind}</span>
                    
                    <button onClick={() => {
                      const winds = ['동', '남', '서', '북'];
                      setWind(prev => winds[(winds.indexOf(prev) + 1) % 4]);
                    }} className="bg-gray-100 w-8 h-8 rounded font-bold hover:bg-gray-200">+</button>
                  </div>
                </div>

                {/* 국 번호 박스 ( + - 버튼 및 3인 게임 제한 ) */}
                <div className="flex-1 flex justify-between items-center p-2.5 bg-white rounded-xl border border-gray-100 shadow-sm min-w-[120px]">
                  <span className="font-bold text-[#2E7D32] text-sm">국</span>
                  <div className="flex items-center gap-1.5">
                    {/* 💡 국 번호 변경 시 본장(honba) 0으로 초기화 */}
                    <button onClick={() => { setRoundNum(Math.max(1, roundNum - 1)); setHonba(0); }} className="bg-gray-100 w-8 h-8 rounded font-bold hover:bg-gray-200">-</button>
                    <span className="font-bold text-lg w-4 text-center text-black">{roundNum}</span>
                    <button onClick={() => { 
                      const maxRound = currentGame?.type === '3인' ? 3 : 4; // 💡 3인 게임은 최대 3국까지만
                      setRoundNum(Math.min(maxRound, roundNum + 1)); 
                      setHonba(0); 
                    }} className="bg-gray-100 w-8 h-8 rounded font-bold hover:bg-gray-200">+</button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-1 flex justify-between p-2.5 bg-white rounded-xl border border-gray-100 shadow-sm items-center">
                  <span className="font-bold text-green-700 text-sm">본장</span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setHonba(Math.max(0, honba - 1))} className="bg-gray-100 w-8 h-8 rounded font-bold hover:bg-gray-200">-</button>
                    <span className="font-bold text-lg w-4 text-center text-black-700">{honba}</span>
                    <button onClick={() => setHonba(honba + 1)} className="bg-gray-100 w-8 h-8 rounded font-bold hover:bg-gray-200">+</button>
                  </div>
                </div>
                <div className="flex-1 flex justify-between p-2.5 bg-white rounded-xl border border-gray-100 shadow-sm items-center">
                  <span className="font-bold text-green-700 text-sm">공탁</span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setKyotaku(Math.max(0, kyotaku - 1))} className="bg-gray-100 w-8 h-8 rounded font-bold hover:bg-gray-200">-</button>
                    <span className="font-bold text-lg w-4 text-center text-black-700">{kyotaku}</span>
                    <button onClick={() => setKyotaku(kyotaku + 1)} className="bg-gray-100 w-8 h-8 rounded font-bold hover:bg-gray-200">+</button>
                  </div>
                </div>
              </div>
            </section>

            {recordMode === '화료' ? (
              <>
                <section className="space-y-3"><h3 className="font-bold text-base text-gray-800 border-b pb-1">화료 형태</h3><div className="flex gap-2"><button onClick={() => handleWinTypeChange('쯔모')} className={`flex-1 py-3 rounded-xl font-bold border-2 ${winType === '쯔모' ? 'border-[#2E7D32] bg-[#2E7D32] text-white' : 'bg-white text-gray-400 border-gray-100'}`}>쯔모</button><button onClick={() => handleWinTypeChange('론')} className={`flex-1 py-3 rounded-xl font-bold border-2 ${winType === '론' ? 'border-[#2E7D32] bg-[#2E7D32] text-white' : 'bg-white text-gray-400 border-gray-100'}`}>론</button></div><div className="flex gap-2"><button onClick={() => setMenzen('멘젠')} className={`flex-1 py-3 rounded-xl font-bold border-2 ${menzen === '멘젠' ? 'border-[#2E7D32] bg-[#2E7D32] text-white' : 'bg-white text-gray-400 border-gray-100'}`}>멘젠</button><button onClick={() => setMenzen('비멘젠')} className={`flex-1 py-3 rounded-xl font-bold border-2 ${menzen === '비멘젠' ? 'border-[#2E7D32] bg-[#2E7D32] text-white' : 'bg-white text-gray-400 border-gray-100'}`}>비멘젠</button></div></section>
                <section className="space-y-2"><div className="flex justify-between items-end"><h3 className="font-bold text-base text-gray-800">화료자 / 방총자</h3><p className="text-[10px] text-gray-400 font-medium">클릭: 화료 / 더블클릭: 방총</p></div><div className="grid grid-cols-2 gap-2">{players.map((player, index) => (<button key={index} onTouchStart={() => handlePlayerTouchStart(index)} onTouchEnd={handlePlayerTouchEnd} onClick={() => handlePlayerClick(index)} className={`relative h-14 rounded-xl font-bold text-base transition-all border-2 select-none ${winner === index ? 'bg-[#2E7D32] border-[#2E7D32] text-white shadow-inner' : loser === index ? 'bg-orange-500 border-orange-500 text-white shadow-inner' : 'bg-white border-gray-200 text-gray-800'}`}>{winner === index && <span className="absolute top-1 left-2 text-[9px] bg-white text-[#2E7D32] px-1 rounded font-black">화료</span>}{loser === index && <span className="absolute top-1 left-2 text-[9px] bg-white text-orange-600 px-1 rounded font-black">방총</span>}{player}</button>))}</div></section>
                <section className="space-y-2"><h3 className="font-bold text-base text-gray-800">대기 형태</h3><div className="grid grid-cols-3 gap-2">{['양면', '샤보', '간짱', '변짱', '단기', '특수대기'].map(t => <button key={t} onClick={() => setWaitType(t)} className={`p-2.5 rounded-xl text-center text-sm font-bold border-2 ${waitType === t ? 'border-[#2E7D32] bg-[#2E7D32] text-white' : 'bg-white border-gray-100 text-gray-600'}`}>{t}</button>)}</div></section>
                <section className="space-y-4"><div className="flex justify-between items-end border-b pb-1"><div className="flex items-center gap-2"><h3 className="font-bold text-base text-gray-800">역 선택</h3><span className="text-[10px] text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">더블클릭: 후로 감소</span></div><span className="text-xs font-bold text-[#2E7D32]">선택됨: {selectedYaku.length}개</span></div>
                  {Object.entries(yakuData).map(([category, yakus]) => (<div key={category} className="space-y-1.5"><h4 className="font-bold text-[#2E7D32] text-xs">{category}</h4><div className="grid grid-cols-3 gap-1.5">{yakus.map(yaku => { if (activeTab === '3인' && yaku === '삼색동순') return null; const isSelected = selectedYaku.includes(yaku); const isDecreased = furoDecreased.includes(yaku); const canDecrease = targetFuroYaku.includes(yaku); return (<button key={yaku} onClick={() => toggleYaku(yaku)} onTouchStart={() => canDecrease && handleYakuTouchStart(yaku)} onTouchEnd={() => canDecrease && handleYakuTouchEnd()} onDoubleClick={() => canDecrease && handleYakuDoubleClick(yaku)} className={`relative p-2 rounded-lg text-xs font-bold border transition-colors select-none ${isSelected ? 'bg-green-50 border-[#2E7D32] text-[#2E7D32] shadow-sm' : 'bg-white border-gray-200 text-gray-600'}`}>{isSelected && isDecreased && <span className="absolute -top-2 left-1 text-[8px] bg-orange-100 border border-orange-400 text-orange-600 px-1 rounded shadow-sm">후로 감소 (-1)</span>}{yaku}</button>);})}</div></div>))}
                </section>
                <section className="space-y-3"><h3 className="font-bold text-base text-gray-800 border-b pb-1">도라 / 부수 / 판수 (자동계산)</h3>
                  <div className="grid grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-gray-100"><div className="flex justify-between items-center"><span className="font-bold text-amber-600 text-sm">도라</span><div className="flex items-center gap-2"><button onClick={() => setDora(Math.max(0, dora - 1))} className="w-6 h-6 bg-gray-100 rounded font-bold">-</button><span className="w-4 text-center font-bold">{dora}</span><button onClick={() => setDora(dora + 1)} className="w-6 h-6 bg-gray-100 rounded font-bold">+</button></div></div><div className="flex justify-between items-center"><span className="font-bold text-amber-600 text-sm">적도라</span><div className="flex items-center gap-2"><button onClick={() => setAka(Math.max(0, aka - 1))} className="w-6 h-6 bg-gray-100 rounded font-bold">-</button><span className="w-4 text-center font-bold">{aka}</span><button onClick={() => setAka(aka + 1)} className="w-6 h-6 bg-gray-100 rounded font-bold">+</button></div></div><div className="flex justify-between items-center"><span className="font-bold text-amber-600 text-sm">뒷도라</span><div className="flex items-center gap-2"><button onClick={() => setUra(Math.max(0, ura - 1))} className="w-6 h-6 bg-gray-100 rounded font-bold">-</button><span className="w-4 text-center font-bold">{ura}</span><button onClick={() => setUra(ura + 1)} className="w-6 h-6 bg-gray-100 rounded font-bold">+</button></div></div>{activeTab === '3인' && (<div className="flex justify-between items-center"><span className="font-bold text-amber-600 text-sm">북</span><div className="flex items-center gap-2"><button onClick={() => setPei(Math.max(0, pei - 1))} className="w-6 h-6 bg-gray-100 rounded font-bold">-</button><span className="w-4 text-center font-bold">{pei}</span><button onClick={() => setPei(pei + 1)} className="w-6 h-6 bg-gray-100 rounded font-bold">+</button></div></div>)}</div>
                  <div className="flex gap-3">
                    <div className="flex-1 flex justify-between p-3 bg-white rounded-xl border border-gray-100 items-center">
                      <span className="font-bold text-[#2E7D32] text-sm">부수</span>
                      <div className="flex items-center gap-2">
                        {/* 💡 산술 계산 대신 fuList 배열의 인덱스를 찾아 이전/다음 값을 반환하도록 수정 */}
                        <button onClick={() => setFu(prev => fuList[Math.max(0, fuList.indexOf(prev) - 1)])} className="bg-gray-100 w-8 h-8 rounded font-bold hover:bg-gray-200">-</button>
                        <span className="font-bold text-lg w-6 text-center">{fu}</span>
                        <button onClick={() => setFu(prev => fuList[Math.min(fuList.length - 1, fuList.indexOf(prev) + 1)])} className="bg-gray-100 w-8 h-8 rounded font-bold hover:bg-gray-200">+</button>
                      </div>
                    </div>
                    <div className="flex-1 flex justify-between p-3 bg-green-50 rounded-xl border border-green-200 items-center relative">
                      <span className="absolute -top-2 left-2 bg-green-200 text-green-800 text-[9px] px-1 rounded font-bold shadow-sm">자동계산</span>
                      <span className="font-bold text-[#2E7D32] text-sm">판수</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setHan(Math.max(1, han - 1))} className="bg-white w-8 h-8 rounded font-bold shadow-sm hover:bg-gray-50">-</button>
                        <span className="font-bold text-xl w-6 text-center text-[#2E7D32]">{han}</span>
                        <button onClick={() => setHan(han + 1)} className="bg-white w-8 h-8 rounded font-bold shadow-sm hover:bg-gray-50">+</button>
                      </div>
                    </div>
                  </div>
                  <input type="number" inputMode="numeric" placeholder="화료 점수 직접 입력 (선택사항, 예: 8000)" value={score} onChange={(e) => setScore(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 bg-white font-bold text-sm focus:outline-none focus:border-[#2E7D32]" />
                </section>
              </>
            ) : recordMode === '유국' ? (
              <>
                <section className="space-y-3"><div className="flex justify-between items-end border-b pb-1"><h3 className="font-bold text-base text-gray-800">텐파이 플레이어</h3><p className="text-[10px] text-gray-400">선택 안하면 전원 노텐</p></div><div className="grid grid-cols-2 gap-2">{players.map((player, index) => <button key={`tenpai-${index}`} onClick={() => toggleTenpai(index)} disabled={abortiveType !== null} className={`h-12 rounded-xl font-bold text-sm transition-all border-2 select-none ${tenpaiPlayers.includes(index) ? 'bg-[#2E7D32] border-[#2E7D32] text-white shadow-inner' : 'bg-white border-gray-200 text-gray-800 disabled:opacity-50'}`}>{player}</button>)}</div></section>
                <section className="space-y-3"><div className="flex justify-between items-end border-b pb-1"><h3 className="font-bold text-base text-gray-800">유국만관 발생</h3></div><div className="grid grid-cols-2 gap-2">{players.map((player, index) => <button key={`nagashi-${index}`} onClick={() => toggleNagashi(index)} disabled={abortiveType !== null} className={`h-12 rounded-xl font-bold text-sm transition-all border-2 select-none ${nagashiMangan.includes(index) ? 'bg-red-500 border-red-500 text-white shadow-inner' : 'bg-white border-gray-200 text-gray-600 disabled:opacity-50'}`}>{player}</button>)}</div></section>
                <section className="space-y-3"><div className="flex justify-between items-end border-b pb-1"><h3 className="font-bold text-base text-gray-800">도중유국 (선택)</h3></div><div className="grid grid-cols-2 gap-2">{abortiveDraws.map(type => <button key={type} onClick={() => toggleAbortive(type)} className={`h-12 rounded-xl text-center font-bold text-sm border-2 transition-colors ${abortiveType === type ? 'bg-gray-700 border-gray-700 text-white shadow-inner' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>{type}</button>)}</div></section>
              </>
            ) : (
              <>
                <section className="space-y-3"><div className="flex justify-between items-end border-b pb-1"><h3 className="font-bold text-base text-red-600">촌보 발생자 선택</h3></div><div className="grid grid-cols-2 gap-2">{players.map((player, index) => <button key={`chombo-${index}`} onClick={() => setChomboPlayer(index)} className={`h-14 rounded-xl font-bold text-base transition-all border-2 select-none ${chomboPlayer === index ? 'bg-red-500 border-red-500 text-white shadow-inner' : 'bg-white border-gray-200 text-gray-800'}`}>{player}</button>)}</div></section>
              </>
            )}
            <section className="pt-4 border-t border-gray-200"><textarea placeholder="해당 국에 대한 메모나 코멘트를 자유롭게 적어주세요. (선택)" value={roundComment} onChange={(e) => setRoundComment(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-[#2E7D32] h-20 resize-none"></textarea></section>
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
              <div className="space-y-2">{players.map((p, i) => (<div key={i} className="flex gap-3 items-center bg-white p-3 rounded-xl border border-gray-200 shadow-sm"><span className="w-14 font-bold truncate text-gray-800 text-sm">{p}</span><input type="number" inputMode="numeric" placeholder="소점" value={finalScores[i]?.score ?? ''} onChange={(e) => updateFinalScore(i, e.target.value)} className="flex-1 p-2 bg-gray-50 border border-gray-200 rounded-lg text-right font-bold text-sm focus:outline-none focus:border-[#2E7D32]" /></div>))}</div>
              <p className="text-center text-gray-400 text-[10px] font-bold mt-2">※ PT(우마/오카)는 자동 계산됩니다.</p>
            </div>
            <div className="p-4 bg-white border-t border-gray-200 shadow-md"><button onClick={handleConfirmEndGame} className="w-full bg-[#1e293b] text-white font-bold text-sm py-3.5 rounded-xl hover:bg-gray-800 active:scale-[0.98] transition-all">결과 저장 및 대국 종료</button></div>
          </div>
        </div>
      )}

      {/* 네비게이션 바 */}
      <nav className="fixed bottom-0 w-full bg-white border-t border-gray-200 flex justify-around p-2 pb-6 z-10">
        <button className={`flex flex-col items-center p-2 transition-colors ${activeNav === '기록' ? 'text-[#2E7D32]' : 'text-gray-400'}`} onClick={() => {setActiveNav('기록'); setSelectedGameId(null);}}><List size={24} /><span className="text-[10px] mt-1 font-bold">대국 기록</span></button>
        <button className={`flex flex-col items-center p-2 transition-colors ${activeNav === '통계' ? 'text-[#2E7D32]' : 'text-gray-400'}`} onClick={() => setActiveNav('통계')}><BarChart2 size={24} /><span className="text-[10px] mt-1 font-bold">통계</span></button>
        <button className={`flex flex-col items-center p-2 transition-colors ${activeNav === '랭킹' ? 'text-[#2E7D32]' : 'text-gray-400'}`} onClick={() => setActiveNav('랭킹')}><Trophy size={24} /><span className="text-[10px] mt-1 font-bold">랭킹</span></button>
        <button className={`flex flex-col items-center p-2 transition-colors ${activeNav === '업데이트' ? 'text-[#2E7D32]' : 'text-gray-400'}`} onClick={() => {setActiveNav('업데이트'); setSelectedGameId(null);}}><Bell size={24} /><span className="text-[10px] mt-1 font-bold">업데이트</span></button>
      </nav>
    </div>
  );
}

export default App;