import { useState, useRef, useEffect } from 'react';
import { Gamepad2, Plus, List, BarChart2, Trophy, ChevronLeft, Check, Trash2, ShieldAlert, Users, X, Flag, Edit } from 'lucide-react';
import { db } from './firebase'; // 우리가 만든 서버 설정 불러오기
import { doc, setDoc, onSnapshot } from 'firebase/firestore'; // 서버 통신 함수들

const yakuData = {
  '1판 역': ['리치', '일발', '멘젠쯔모', '탕야오', '핑후', '이페코', '백', '발', '중', '자풍패', '장풍패', '해저로월', '하저로어', '영상개화', '창깡'],
  '2판 역': ['더블리치', '치또이쯔', '일기통관', '삼색동순', '삼색동각', '또이또이', '산안커', '찬타', '소삼원', '혼노두', '산깡쯔'],
  '3판 역': ['혼일색', '준찬타', '량페코'],
  '6판 역': ['청일색'],
  '역만': ['천화', '지화', '인화', '스안커', '국사무쌍', '대삼원', '구련보등', '소사희', '자일색', '녹일색', '청노두', '스깡쯔', '대차륜', '대죽림', '대수린', '석상삼년'],
  '더블역만': ['대사희', '스안커 단기', '국사무쌍 13면 대기', '순정구련보등', '홍공작', '대칠성']
};

const targetFuroYaku = ['일기통관', '삼색동순', '찬타', '준찬타', '혼일색'];
const abortiveDraws = ['구종구패', '사풍연타', '사깡유국', '사가리치'];

function App() {
  const [activeTab, setActiveTab] = useState('4인');
  const [activeNav, setActiveNav] = useState('기록');
  
  // --- 🌟 Firebase 실시간 데이터베이스 연동 ---
  const [games, setGames] = useState([]); 
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 서버의 'mahjong/all_games' 문서를 실시간으로 감시합니다.
    const unsub = onSnapshot(doc(db, 'mahjong', 'all_games'), (docSnap) => {
      if (docSnap.exists()) setGames(docSnap.data().games || []);
      else setGames([]);
      setIsLoading(false);
    });
    return () => unsub(); // 앱이 꺼질 때 연결 해제
  }, []);

  // 서버에 데이터를 덮어쓰는(저장하는) 함수
  const syncGamesToDB = async (newGames) => {
    try {
      await setDoc(doc(db, 'mahjong', 'all_games'), { games: newGames });
    } catch (e) {
      console.error("서버 저장 실패:", e);
      alert("서버 저장에 실패했습니다. 인터넷 연결을 확인해주세요.");
    }
  };

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

  const currentGame = games.find(g => g.id === selectedGameId);
  const records = currentGame ? currentGame.rounds : [];
  const players = currentGame ? currentGame.players : [];
  const displayedGames = games.filter(g => g.type === activeTab);

  const totalRecords = records.length;
  const winRecords = records.filter(r => r.type === '화료');
  const tsumoCount = winRecords.filter(r => r.winType === '쯔모').length;
  const ronCount = winRecords.filter(r => r.winType === '론').length;
  const avgHan = winRecords.length > 0 ? (winRecords.reduce((acc, r) => acc + r.han, 0) / winRecords.length).toFixed(1) : 0;

  const playerTimerRef = useRef(null);
  const handlePlayerTouchStart = (index) => { playerTimerRef.current = setTimeout(() => { if (winType === '론') { setLoser(index); if (winner === index) setWinner(null); } }, 500); };
  const handlePlayerTouchEnd = () => { if (playerTimerRef.current) clearTimeout(playerTimerRef.current); };
  const handlePlayerDoubleClick = (index) => { if (winType === '론') { setLoser(index); if (winner === index) setWinner(null); } };
  const handlePlayerClick = (index) => { setWinner(index); if (loser === index) setLoser(null); };
  const handleWinTypeChange = (type) => { setWinType(type); if (type === '쯔모') setLoser(null); };
  const yakuTimerRef = useRef(null);
  const toggleYaku = (yaku) => setSelectedYaku(prev => prev.includes(yaku) ? prev.filter(y => y !== yaku) : [...prev, yaku]);
  const toggleFuroDecrease = (yaku) => { setFuroDecreased(prev => prev.includes(yaku) ? prev.filter(y => y !== yaku) : [...prev, yaku]); setSelectedYaku(prev => prev.includes(yaku) ? prev : [...prev, yaku]); };
  const handleYakuTouchStart = (yaku) => { if (!targetFuroYaku.includes(yaku)) return; yakuTimerRef.current = setTimeout(() => toggleFuroDecrease(yaku), 500); };
  const handleYakuTouchEnd = () => { if (yakuTimerRef.current) clearTimeout(yakuTimerRef.current); };
  const handleYakuDoubleClick = (yaku) => { if (!targetFuroYaku.includes(yaku)) return; toggleFuroDecrease(yaku); };
  const toggleTenpai = (index) => { setTenpaiPlayers(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]); setAbortiveType(null); };
  const toggleNagashi = (index) => setNagashiMangan(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]);
  const toggleAbortive = (type) => { setAbortiveType(prev => prev === type ? null : type); if (abortiveType !== type) setTenpaiPlayers([]); };

  const handleCreateNewGame = () => {
    if (activeTab === '4인' && (!playerE || !playerS || !playerW || !playerN)) return alert("모든 플레이어 이름을 입력해주세요!");
    if (activeTab === '3인' && (!playerE || !playerS || !playerW)) return alert("모든 플레이어 이름을 입력해주세요!");
    const newGame = { id: Date.now(), date: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\./g, '.').slice(0, -1), type: activeTab, players: activeTab === '4인' ? [playerE, playerS, playerW, playerN] : [playerE, playerS, playerW], rounds: [], status: '진행중', finalResults: null };
    syncGamesToDB([newGame, ...games]); // 서버에 동기화
    setIsNewGameModalOpen(false); setSelectedGameId(newGame.id); setPlayerE(''); setPlayerS(''); setPlayerW(''); setPlayerN('');
  };

  const handleSaveRound = () => {
    let newRound = { id: Date.now(), wind, roundNum, honba, kyotaku, type: recordMode };
    if (recordMode === '화료') {
      if (winner === null) return alert("화료자를 선택해주세요!");
      if (winType === '론' && loser === null) return alert("방총자를 선택해주세요!");
      newRound = { ...newRound, winType, menzen, waitType, winner: players[winner], loser: loser !== null ? players[loser] : null, selectedYaku, furoDecreased, dora, aka, ura, pei, fu, han, score };
    } else {
      newRound = { ...newRound, tenpaiPlayers: tenpaiPlayers.map(i => players[i]), nagashiMangan: nagashiMangan.map(i => players[i]), abortiveType };
    }
    const updatedGames = games.map(game => game.id === selectedGameId ? { ...game, rounds: [newRound, ...game.rounds] } : game);
    syncGamesToDB(updatedGames); // 서버에 동기화
    setIsRoundModalOpen(false); setWinner(null); setLoser(null); setSelectedYaku([]); setFuroDecreased([]); setDora(0); setAka(0); setUra(0); setPei(0); setTenpaiPlayers([]); setNagashiMangan([]); setAbortiveType(null);
  };

  const handleDeleteRound = (roundId) => { 
    if(confirm("이 국의 기록을 삭제하시겠습니까?")) syncGamesToDB(games.map(game => game.id === selectedGameId ? { ...game, rounds: game.rounds.filter(r => r.id !== roundId) } : game)); 
  };
  const handleDeleteGame = (e, gameId) => { 
    e.stopPropagation(); 
    if(confirm("이 대국의 전체 기록을 삭제하시겠습니까? 복구할 수 없습니다.")) { syncGamesToDB(games.filter(g => g.id !== gameId)); if(selectedGameId === gameId) setSelectedGameId(null); } 
  };

  const handleOpenEndGame = () => {
    if (currentGame.finalResults) setFinalScores(currentGame.finalResults.map(f => ({ score: f.score })));
    else setFinalScores(players.map(() => ({ score: '' })));
    setIsEndGameModalOpen(true);
  };

  const updateFinalScore = (index, value) => { const newScores = [...finalScores]; newScores[index].score = value; setFinalScores(newScores); };

  const handleConfirmEndGame = () => {
    if (finalScores.some(f => f.score === '')) return alert("모든 플레이어의 소점을 입력해주세요!");
    const totalScore = finalScores.reduce((sum, f) => sum + parseInt(f.score), 0);
    const expectedTotal = players.length === 4 ? 100000 : 105000;
    if (totalScore !== expectedTotal) return alert(`총합이 맞지 않습니다!\n(필요 점수: ${expectedTotal}점 / 현재 총합: ${totalScore}점)`);

    const scoresWithIndex = finalScores.map((f, index) => ({ score: parseInt(f.score), index }));
    scoresWithIndex.sort((a, b) => b.score !== a.score ? b.score - a.score : a.index - b.index);

    const calculatedResults = [...finalScores];
    scoresWithIndex.forEach((item, rank) => {
      let pt = 0;
      if (players.length === 4) pt = (item.score - 30000) / 1000 + [50, 10, -10, -30][rank];
      else pt = (item.score - 40000) / 1000 + [45, 0, -30][rank];
      calculatedResults[item.index] = { score: item.score, pt: parseFloat(pt.toFixed(1)) };
    });
    syncGamesToDB(games.map(game => game.id === selectedGameId ? { ...game, status: '종료', finalResults: calculatedResults } : game));
    setIsEndGameModalOpen(false);
  };

  // --- 🏆 랭킹 데이터 계산 로직 ---
  const getRankingData = () => {
    const stats = {};
    games.filter(g => g.type === activeTab && g.status === '종료').forEach(game => {
      const sorted = game.finalResults.map((r, i) => ({ ...r, player: game.players[i] })).sort((a, b) => b.score - a.score);
      sorted.forEach((res, rank) => {
        const p = res.player;
        if (!stats[p]) stats[p] = { name: p, playCount: 0, totalPt: 0, ranks: [0, 0, 0, 0], maxScore: -999999, minScore: 999999, tobi: 0 };
        stats[p].playCount += 1;
        stats[p].totalPt += res.pt;
        stats[p].ranks[rank] += 1;
        if (res.score > stats[p].maxScore) stats[p].maxScore = res.score;
        if (res.score < stats[p].minScore) stats[p].minScore = res.score;
        if (res.score < 0) stats[p].tobi += 1;
      });
    });
    return Object.values(stats).sort((a, b) => b.totalPt - a.totalPt);
  };

  const rankingData = getRankingData();

  if (isLoading) return <div className="h-screen w-full flex items-center justify-center bg-[#F5F5DC] text-[#2E7D32] font-bold">서버 연결 중...</div>;

  return (
    <div className="flex flex-col h-screen bg-[#F5F5DC] font-sans relative overflow-hidden text-[#1A1A1A]">
      <header className="bg-[#2E7D32] text-white p-5 pt-10 shadow-md z-20 flex items-center justify-between">
        {activeNav === '기록' && selectedGameId !== null ? (
          <>
            <button onClick={() => setSelectedGameId(null)} className="p-1 hover:bg-green-700 rounded-full transition-colors"><ChevronLeft size={28} /></button>
            <div className="text-center flex-1"><h1 className="text-xl font-bold">{currentGame.type} 대국 상세</h1><p className="text-[11px] text-green-100 mt-0.5">{players.join(' · ')}</p></div>
            <div className="w-8"></div>
          </>
        ) : (
          <h1 className="text-2xl font-bold tracking-tight w-full text-center">
            {activeNav === '기록' && '대국 기록'}
            {activeNav === '통계' && '개인 통계'}
            {activeNav === '랭킹' && '전체 랭킹'}
          </h1>
        )}
      </header>

      {/* 탭 공통 UI */}
      {(selectedGameId === null || activeNav !== '기록') && (
        <div className="flex bg-white border-b border-gray-200 shadow-sm z-10 sticky top-0">
          <button className={`flex-1 py-3 text-center font-bold flex justify-center items-center gap-2 border-b-2 ${activeTab === '4인' ? 'border-[#2E7D32] text-[#2E7D32]' : 'border-transparent text-gray-500'}`} onClick={() => setActiveTab('4인')}>
            4인 게임 <span className={`text-xs px-2 py-0.5 rounded-full text-white ${activeTab === '4인' ? 'bg-[#2E7D32]' : 'bg-gray-300'}`}>{games.filter(g=>g.type==='4인').length}</span>
          </button>
          <button className={`flex-1 py-3 text-center font-bold flex justify-center items-center gap-2 border-b-2 ${activeTab === '3인' ? 'border-[#2E7D32] text-[#2E7D32]' : 'border-transparent text-gray-500'}`} onClick={() => setActiveTab('3인')}>
            3인 게임 <span className={`text-xs px-2 py-0.5 rounded-full text-white ${activeTab === '3인' ? 'bg-[#2E7D32]' : 'bg-gray-300'}`}>{games.filter(g=>g.type==='3인').length}</span>
          </button>
        </div>
      )}

      <main className="flex-1 overflow-y-auto flex flex-col relative pb-24">
        
        {/* ========================================= */}
        {/* 화면 1: 대국 기록 탭 (메인 리스트) */}
        {/* ========================================= */}
        {activeNav === '기록' && selectedGameId === null && (
          <div className="flex-1 flex flex-col p-4 space-y-4">
            {displayedGames.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center mt-20 text-gray-400">
                <Gamepad2 size={80} strokeWidth={1} className="mb-4" />
                <h2 className="text-lg font-bold mb-3">아직 대국 기록이 없습니다</h2>
                <p className="text-sm">우측 하단 + 버튼으로 새 대국을 만드세요</p>
              </div>
            ) : (
              displayedGames.map(game => (
                <div key={game.id} onClick={() => setSelectedGameId(game.id)} className="bg-white p-4 rounded-[20px] shadow-sm border border-gray-100 relative cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]">
                  <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-400 font-medium">{game.date}</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded ${game.status === '종료' ? 'text-gray-600 bg-gray-100' : 'text-[#2E7D32] bg-green-50'}`}>{game.rounds.length}국</span>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded ${game.status === '종료' ? 'text-gray-500 bg-gray-200' : 'text-[#2E7D32] bg-green-50'}`}>{game.status}</span>
                      </div>
                  </div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-[17px] text-gray-800 truncate pr-4 tracking-tight">{game.players.join(' · ')}</h3>
                    <button onClick={(e) => handleDeleteGame(e, game.id)} className="text-red-400 hover:text-red-500 p-1"><Trash2 size={16} /></button>
                  </div>
                  {game.status === '종료' && game.finalResults ? (
                    <div className={`bg-gray-50 rounded-xl p-3.5 border border-gray-100 grid gap-x-4 gap-y-3 mt-1 ${game.type === '4인' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {game.players.map((p, i) => (
                        <div key={i} className="flex justify-between items-center">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-black ${i===0?'text-[#2E7D32]':i===1?'text-orange-500':i===2?'text-gray-500':'text-blue-600'}`}>{['東','南','西','北'][i]}</span>
                            <span className="text-[13px] font-bold text-gray-700 truncate w-14">{p}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className={`text-[13px] font-black leading-none ${game.finalResults[i].pt > 0 ? 'text-[#2E7D32]' : game.finalResults[i].pt < 0 ? 'text-red-500' : 'text-gray-500'}`}>{game.finalResults[i].pt > 0 ? '+' : ''}{game.finalResults[i].pt}</span>
                            <span className="text-[10px] font-medium text-gray-400 leading-none mt-1.5">{Number(game.finalResults[i].score).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex gap-2.5 text-[11px] font-medium mt-1">{game.players.map((p, i) => (<span key={i} className="text-gray-600"><span className={`font-bold ${i===0?'text-[#2E7D32]':i===1?'text-orange-500':i===2?'text-gray-500':'text-blue-600'}`}>{['동','남','서','북'][i]}</span> {p}</span>))}</div>
                  )}
                </div>
              ))
            )}
            <div className="fixed bottom-20 right-6 z-20">
              <button onClick={() => setIsNewGameModalOpen(true)} className="bg-[#2E7D32] text-white p-4 rounded-full shadow-lg hover:bg-green-800 active:scale-95 transition-transform"><Plus size={28} strokeWidth={3} /></button>
            </div>
          </div>
        )}

        {/* ========================================= */}
        {/* 화면 1-B: 대국 상세 화면 */}
        {/* ========================================= */}
        {activeNav === '기록' && selectedGameId !== null && currentGame && (
          <div className="flex-1 flex flex-col">
            <div className="bg-white border-b border-gray-200 grid grid-cols-4 divide-x divide-gray-100 text-center py-3 shadow-sm z-10 sticky top-0">
              <div className="flex flex-col"><span className="text-xl font-black text-[#2E7D32]">{totalRecords}</span><span className="text-[10px] text-gray-500 font-bold">총 기록</span></div>
              <div className="flex flex-col"><span className="text-xl font-black text-[#2E7D32]">{tsumoCount}</span><span className="text-[10px] text-gray-500 font-bold">쯔모</span></div>
              <div className="flex flex-col"><span className="text-xl font-black text-orange-500">{ronCount}</span><span className="text-[10px] text-gray-500 font-bold">론</span></div>
              <div className="flex flex-col"><span className="text-xl font-black text-gray-800">{avgHan}</span><span className="text-[10px] text-gray-500 font-bold">평균판수</span></div>
            </div>

            <div className="p-4 pb-0">
              <div className="bg-[#2E7D32] bg-opacity-5 p-3 rounded-xl border border-green-100 flex justify-between items-center text-sm font-bold shadow-inner">
                 {players.map((p, i) => (
                   <div key={i} className={`text-center flex-1 ${i>0 && 'border-l border-green-200 border-opacity-50'}`}>
                     <span className={`block text-[10px] mb-0.5 ${i===0?'text-[#2E7D32]':i===1?'text-orange-500':i===2?'text-gray-500':'text-blue-600'}`}>{['東(동)','南(남)','西(서)','北(북)'][i]}</span>{p}
                   </div>
                 ))}
              </div>

              {currentGame.status === '종료' && currentGame.finalResults && (
                <div className="bg-[#1e293b] text-white rounded-xl p-5 mt-4 relative shadow-lg animate-in fade-in">
                  <button onClick={handleOpenEndGame} className="absolute top-4 right-4 text-[11px] font-bold bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded flex items-center gap-1 transition-colors"><Edit size={12}/> 수정</button>
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Trophy size={20} className="text-yellow-400"/> 최종 대국 결과</h3>
                  <div className="space-y-2">
                    {players.map((p, i) => (
                      <div key={i} className="flex justify-between items-center py-2 border-b border-gray-700 last:border-0">
                        <span className="font-bold">{p}</span>
                        <div className="flex items-center gap-4 text-right">
                          <span className="w-20 font-medium text-gray-300">{Number(currentGame.finalResults[i].score).toLocaleString()}점</span>
                          <span className={`w-14 font-black text-lg ${parseFloat(currentGame.finalResults[i].pt) > 0 ? 'text-green-400' : parseFloat(currentGame.finalResults[i].pt) < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                            {parseFloat(currentGame.finalResults[i].pt) > 0 ? '+' : ''}{currentGame.finalResults[i].pt}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {currentGame.status === '진행중' && (
                <button onClick={handleOpenEndGame} className="w-full bg-[#1e293b] text-white font-bold py-4 rounded-xl mt-4 flex justify-center items-center gap-2 hover:bg-gray-800 transition-colors shadow-md"><Flag size={20} /> 대국 종료 및 점수 입력</button>
              )}
            </div>

            <div className="p-4 space-y-4">
              {records.length === 0 ? (
                <div className="text-center py-10 text-gray-400 font-bold"><p>우측 하단의 + 버튼을 눌러</p><p>첫 번째 국을 기록해주세요!</p></div>
              ) : (
                records.map(record => (
                  <div key={record.id} className={`rounded-2xl p-4 shadow-sm border relative animate-in fade-in slide-in-from-bottom-2 ${record.type === '유국' ? 'bg-gray-50 border-gray-300' : 'bg-white border-gray-100'}`}>
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        {record.type === '화료' ? <span className="bg-[#2E7D32] bg-opacity-10 text-[#2E7D32] px-2 py-0.5 rounded font-bold text-sm">{record.han}판</span> : <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded font-bold text-sm">유국</span>}
                        <span className="font-bold text-gray-800">{record.wind}{record.roundNum}국 {record.honba > 0 && `${record.honba}본`}</span>
                      </div>
                      <button onClick={() => handleDeleteRound(record.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={18} /></button>
                    </div>

                    {record.type === '화료' ? (
                      <>
                        <div className="flex items-center gap-3 mb-3"><span className={`font-bold text-sm ${record.winType === '쯔모' ? 'text-[#2E7D32]' : 'text-orange-500'}`}>{record.winType}</span><span className="font-bold text-lg text-gray-800">{record.winner} {record.winType === '론' && <span className="text-gray-400 text-sm font-medium mx-2">← {record.loser}</span>}</span></div>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          <span className="bg-gray-100 text-gray-600 text-[11px] px-2 py-1 rounded font-bold border border-gray-200">{record.waitType}</span>
                          {record.menzen === '멘젠' && <span className="bg-green-50 text-green-700 text-[11px] px-2 py-1 rounded font-bold border border-green-100">멘젠</span>}
                          {record.selectedYaku.map(yaku => <span key={yaku} className="bg-green-50 text-green-700 text-[11px] px-2 py-1 rounded font-bold border border-green-100">{yaku} {record.furoDecreased.includes(yaku) && '(-1판)'}</span>)}
                          {(record.dora > 0 || record.aka > 0 || record.ura > 0) && <span className="bg-yellow-50 text-yellow-700 text-[11px] px-2 py-1 rounded font-bold border border-yellow-200">도라 {record.dora + record.aka + record.ura}</span>}
                        </div>
                        <div className="text-xs text-gray-400 font-bold mt-2">{record.han}판 {record.fu}부</div>
                      </>
                    ) : (
                      <div className="space-y-2 mt-1">
                        <div className="flex items-center gap-2"><ShieldAlert size={18} className="text-gray-500" /><span className="font-bold text-gray-800 text-lg">{record.abortiveType ? `도중유국 (${record.abortiveType})` : '황패유국'}</span></div>
                        {!record.abortiveType && (
                          <div className="text-sm font-bold text-gray-600 pl-6 space-y-1">
                            {record.tenpaiPlayers.length > 0 ? <p>텐파이: <span className="text-[#2E7D32]">{record.tenpaiPlayers.join(', ')}</span></p> : <p className="text-gray-400">전원 노텐</p>}
                            {record.nagashiMangan.length > 0 && <p>유국만관: <span className="text-orange-500">{record.nagashiMangan.join(', ')}</span></p>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {currentGame.status === '진행중' && (
              <div className="fixed bottom-20 right-6 z-20">
                <button onClick={() => setIsRoundModalOpen(true)} className="bg-[#2E7D32] text-white p-4 rounded-full shadow-lg hover:bg-green-800 active:scale-95 transition-transform"><Plus size={28} strokeWidth={3} /></button>
              </div>
            )}
          </div>
        )}

        {/* ========================================= */}
        {/* 화면 2: 🏆 랭킹 페이지 */}
        {/* ========================================= */}
        {activeNav === '랭킹' && (
          <div className="p-4 space-y-3">
            <h2 className="font-bold text-gray-800 text-lg mb-2 pl-1">누적 우마(PT) 순위</h2>
            {rankingData.length === 0 ? (
              <div className="text-center py-20 text-gray-400 font-bold bg-white rounded-2xl shadow-sm border border-gray-100">
                <Trophy size={48} className="mx-auto mb-4 text-gray-300" />
                <p>아직 종료된 대국이 없어</p>
                <p>순위를 매길 수 없습니다.</p>
              </div>
            ) : (
              rankingData.map((player, index) => (
                <div key={player.name} className="bg-white p-4 rounded-[20px] shadow-sm border border-gray-100 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-4">
                    {/* 순위 뱃지 (1,2,3등은 색상 다르게) */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-white shadow-inner text-lg
                      ${index === 0 ? 'bg-yellow-400' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-gray-200 text-gray-600'}`}>
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-gray-800">{player.name}</h3>
                      <div className="text-[11px] text-gray-500 font-bold mt-0.5 flex gap-2">
                        <span>{player.playCount}전</span>
                        <span className="text-gray-300">|</span>
                        <span>1위 {player.ranks[0]}회</span>
                        <span className="text-gray-300">|</span>
                        <span>연대율 {((player.ranks[0] + player.ranks[1]) / player.playCount * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xl font-black tracking-tighter ${player.totalPt > 0 ? 'text-[#2E7D32]' : player.totalPt < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                      {player.totalPt > 0 ? '+' : ''}{player.totalPt.toFixed(1)}
                    </div>
                    <div className="text-[10px] text-gray-400 font-bold mt-0.5 bg-gray-50 px-2 py-0.5 rounded inline-block">
                      평균 {(player.totalPt / player.playCount).toFixed(1)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </main>

      {/* --- 모달들 (새 게임, 대국 종료, 국 기록) --- */}
      {/* 코드 길이를 줄이기 위해 모달 부분은 기존과 완벽하게 동일하게 작동합니다 (위에 이미 작성됨) */}
      
      {isEndGameModalOpen && (
        <div className="absolute inset-0 bg-black bg-opacity-60 z-[60] flex flex-col justify-end animate-in fade-in">
          <div className="bg-[#F5F5DC] w-full h-[70%] rounded-t-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom">
            <div className="bg-[#1e293b] rounded-t-3xl p-5 flex justify-between items-center text-white"><h2 className="text-xl font-bold flex items-center gap-2"><Flag size={20} /> 대국 결과 입력</h2><button onClick={() => setIsEndGameModalOpen(false)} className="p-1 hover:bg-gray-700 rounded-full"><X size={24} /></button></div>
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-xl text-sm font-bold shadow-sm">⚠️ 소점 총합은 {players.length === 4 ? '100,000' : '105,000'}점이어야 합니다.<br/>현재 입력 합계: <span className="text-red-500">{finalScores.reduce((sum, f) => sum + (parseInt(f.score) || 0), 0).toLocaleString()}점</span></div>
              <div className="space-y-3">
                {players.map((p, i) => (
                  <div key={i} className="flex gap-4 items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm"><span className="w-16 font-bold truncate text-gray-800 text-lg">{p}</span><input type="number" placeholder="최종 소점 (예: 25000)" value={finalScores[i]?.score || ''} onChange={(e) => updateFinalScore(i, e.target.value)} className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-lg text-right font-bold text-lg focus:outline-none focus:border-[#2E7D32]" /></div>
                ))}
              </div>
              <p className="text-center text-gray-400 text-xs font-bold mt-2">※ PT(우마/오카)는 룰에 맞게 자동 계산됩니다.</p>
            </div>
            <div className="p-5 bg-white border-t border-gray-200 shadow-md"><button onClick={handleConfirmEndGame} className="w-full bg-[#1e293b] text-white font-bold text-lg py-4 rounded-xl hover:bg-gray-800 active:scale-[0.98] transition-all">결과 저장 및 대국 종료</button></div>
          </div>
        </div>
      )}

      {isNewGameModalOpen && (
        <div className="absolute inset-0 bg-black bg-opacity-60 z-50 flex flex-col justify-end animate-in fade-in">
          <div className="bg-[#F5F5DC] w-full h-[85%] rounded-t-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom">
            <div className="bg-[#2E7D32] rounded-t-3xl p-5 flex justify-between items-center text-white"><h2 className="text-xl font-bold">{activeTab} 대국 시작</h2><button onClick={() => setIsNewGameModalOpen(false)} className="p-1 hover:bg-green-700 rounded-full"><X size={24} /></button></div>
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="flex items-center gap-2 mb-6"><Users className="text-[#2E7D32]" /><p className="text-gray-800 font-bold text-lg">초기 좌석을 입력해주세요</p></div>
              <div className="space-y-4">
                <div className="flex items-center gap-4 bg-white p-3 rounded-xl shadow-sm border border-gray-100"><div className="bg-[#2E7D32] text-white w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg shadow-inner">東</div><input type="text" value={playerE} onChange={e => setPlayerE(e.target.value)} placeholder="동가 이름" className="flex-1 text-lg font-bold bg-transparent focus:outline-none" /></div>
                <div className="flex items-center gap-4 bg-white p-3 rounded-xl shadow-sm border border-gray-100"><div className="bg-orange-500 text-white w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg shadow-inner">南</div><input type="text" value={playerS} onChange={e => setPlayerS(e.target.value)} placeholder="남가 이름" className="flex-1 text-lg font-bold bg-transparent focus:outline-none" /></div>
                <div className="flex items-center gap-4 bg-white p-3 rounded-xl shadow-sm border border-gray-100"><div className="bg-gray-500 text-white w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg shadow-inner">西</div><input type="text" value={playerW} onChange={e => setPlayerW(e.target.value)} placeholder="서가 이름" className="flex-1 text-lg font-bold bg-transparent focus:outline-none" /></div>
                {activeTab === '4인' && (
                  <div className="flex items-center gap-4 bg-white p-3 rounded-xl shadow-sm border border-gray-100"><div className="bg-blue-600 text-white w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg shadow-inner">北</div><input type="text" value={playerN} onChange={e => setPlayerN(e.target.value)} placeholder="북가 이름" className="flex-1 text-lg font-bold bg-transparent focus:outline-none" /></div>
                )}
              </div>
              <button onClick={handleCreateNewGame} className="w-full bg-[#2E7D32] text-white font-bold text-lg py-4 rounded-xl mt-8 shadow-md hover:bg-green-800 active:scale-[0.98] transition-all">대국 시작하기</button>
            </div>
          </div>
        </div>
      )}

      {isRoundModalOpen && (
        <div className="absolute inset-0 bg-[#F5F5DC] z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom">
          <div className="bg-[#2E7D32] text-white p-4 flex justify-between items-center pt-10 shadow-sm z-10"><button onClick={() => setIsRoundModalOpen(false)}><ChevronLeft size={28} /></button><h2 className="text-xl font-bold">{wind}{roundNum}국 기록</h2><button onClick={handleSaveRound} className="text-sm font-bold bg-green-700 px-3 py-1 rounded hover:bg-green-600">저장</button></div>
          <div className="flex bg-white shadow-sm z-10"><button onClick={() => setRecordMode('화료')} className={`flex-1 py-4 font-bold border-b-4 transition-colors ${recordMode === '화료' ? 'border-[#2E7D32] text-[#2E7D32]' : 'border-transparent text-gray-400'}`}>화료 (Win)</button><button onClick={() => setRecordMode('유국')} className={`flex-1 py-4 font-bold border-b-4 transition-colors ${recordMode === '유국' ? 'border-gray-600 text-gray-700' : 'border-transparent text-gray-400'}`}>유국 (Draw)</button></div>
          <div className="flex-1 overflow-y-auto p-5 space-y-10 pb-32">
            
            <section className="space-y-4">
              <div className="flex items-center gap-4"><span className="text-gray-500 font-bold w-10">국풍</span><div className="flex gap-2">{['동', '남', '서', '북'].map(w => <button key={w} onClick={() => setWind(w)} className={`w-10 h-10 rounded-lg font-bold border-2 ${wind === w ? 'bg-[#2E7D32] border-[#2E7D32] text-white' : 'bg-white border-gray-200 text-gray-400'}`}>{w}</button>)}</div>
                <div className="flex-1 flex items-center justify-end gap-3"><span className="font-bold text-[#2E7D32]">국 번호</span><div className="flex items-center bg-white rounded-lg border border-gray-200"><button onClick={() => setRoundNum(Math.max(1, roundNum - 1))} className="w-8 h-8 font-bold">-</button><span className="w-6 text-center font-bold text-green-700">{roundNum}</span><button onClick={() => setRoundNum(Math.min(4, roundNum + 1))} className="w-8 h-8 font-bold">+</button></div></div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1 flex justify-between p-3 bg-white rounded-xl border border-gray-100 items-center"><span className="font-bold text-green-700">본장</span><div className="flex items-center gap-2"><button onClick={() => setHonba(Math.max(0, honba - 1))} className="bg-gray-100 w-8 h-8 rounded font-bold">-</button><span className="font-bold text-lg w-4 text-center">{honba}</span><button onClick={() => setHonba(honba + 1)} className="bg-gray-100 w-8 h-8 rounded font-bold">+</button></div></div>
                <div className="flex-1 flex justify-between p-3 bg-white rounded-xl border border-gray-100 items-center"><span className="font-bold text-orange-600">공탁</span><div className="flex items-center gap-2"><button onClick={() => setKyotaku(Math.max(0, kyotaku - 1))} className="bg-gray-100 w-8 h-8 rounded font-bold">-</button><span className="font-bold text-lg w-4 text-center">{kyotaku}</span><button onClick={() => setKyotaku(kyotaku + 1)} className="bg-gray-100 w-8 h-8 rounded font-bold">+</button></div></div>
              </div>
            </section>

            {recordMode === '화료' ? (
              <>
                <section className="space-y-4">
                  <h3 className="font-bold text-lg text-gray-800 border-b pb-2">기본 정보</h3>
                  <div className="flex gap-2"><button onClick={() => handleWinTypeChange('쯔모')} className={`flex-1 py-3 rounded-xl font-bold border-2 ${winType === '쯔모' ? 'border-[#2E7D32] bg-[#2E7D32] text-white' : 'bg-white text-gray-400 border-gray-100'}`}>쯔모</button><button onClick={() => handleWinTypeChange('론')} className={`flex-1 py-3 rounded-xl font-bold border-2 ${winType === '론' ? 'border-[#2E7D32] bg-[#2E7D32] text-white' : 'bg-white text-gray-400 border-gray-100'}`}>론</button></div>
                  <div className="flex gap-2"><button onClick={() => setMenzen('멘젠')} className={`flex-1 py-3 rounded-xl font-bold border-2 ${menzen === '멘젠' ? 'border-[#2E7D32] bg-[#2E7D32] text-white' : 'bg-white text-gray-400 border-gray-100'}`}>멘젠</button><button onClick={() => setMenzen('비멘젠')} className={`flex-1 py-3 rounded-xl font-bold border-2 ${menzen === '비멘젠' ? 'border-[#2E7D32] bg-[#2E7D32] text-white' : 'bg-white text-gray-400 border-gray-100'}`}>비멘젠 (울음)</button></div>
                </section>
                <section className="space-y-3"><div className="flex justify-between items-end"><h3 className="font-bold text-lg text-gray-800">화료자 / 방총자</h3><p className="text-[10px] text-gray-400 font-medium">클릭: 화료 / 더블클릭: 방총</p></div><div className="grid grid-cols-2 gap-3">
                    {players.map((player, index) => (
                      <button key={index} onTouchStart={() => handlePlayerTouchStart(index)} onTouchEnd={handlePlayerTouchEnd} onDoubleClick={() => handlePlayerDoubleClick(index)} onClick={() => handlePlayerClick(index)} className={`relative h-16 rounded-xl font-bold text-lg transition-all border-2 select-none ${winner === index ? 'bg-[#2E7D32] border-[#2E7D32] text-white shadow-inner' : loser === index ? 'bg-orange-500 border-orange-500 text-white shadow-inner' : 'bg-white border-gray-200 text-gray-800'}`}>
                        {winner === index && <span className="absolute top-1 left-2 text-[10px] bg-white text-[#2E7D32] px-1.5 rounded font-black">화료</span>}
                        {loser === index && <span className="absolute top-1 left-2 text-[10px] bg-white text-orange-600 px-1.5 rounded font-black">방총</span>}
                        {player}
                      </button>
                    ))}
                </div></section>
                <section className="space-y-3"><h3 className="font-bold text-lg text-gray-800">대기 형태</h3><div className="grid grid-cols-2 gap-2">{['양면', '샤보', '간짱', '변짱', '단기', '특수대기'].map(t => <button key={t} onClick={() => setWaitType(t)} className={`p-3 rounded-xl text-center font-bold border-2 ${waitType === t ? 'border-[#2E7D32] bg-[#2E7D32] text-white' : 'bg-white border-gray-100 text-gray-600'}`}>{t}</button>)}</div></section>
                <section className="space-y-6"><div className="flex justify-between items-end border-b pb-2"><div className="flex items-center gap-2"><h3 className="font-bold text-lg text-gray-800">역 선택</h3><span className="text-[10px] text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">더블클릭: 후로 감소</span></div><span className="text-sm font-bold text-[#2E7D32]">선택됨: {selectedYaku.length}개</span></div>
                  {Object.entries(yakuData).map(([category, yakus]) => (
                    <div key={category} className="space-y-2"><h4 className="font-bold text-[#2E7D32] text-sm">{category}</h4><div className="grid grid-cols-2 gap-2">
                        {yakus.map(yaku => {
                          const isSelected = selectedYaku.includes(yaku); const isDecreased = furoDecreased.includes(yaku); const canDecrease = targetFuroYaku.includes(yaku);
                          return (
                            <button key={yaku} onClick={() => toggleYaku(yaku)} onTouchStart={() => canDecrease && handleYakuTouchStart(yaku)} onTouchEnd={() => canDecrease && handleYakuTouchEnd()} onDoubleClick={() => canDecrease && handleYakuDoubleClick(yaku)} className={`relative p-3 rounded-lg text-sm font-bold border transition-colors select-none ${isSelected ? 'bg-green-50 border-[#2E7D32] text-[#2E7D32] shadow-sm' : 'bg-white border-gray-200 text-gray-600'}`}>
                              {isSelected && isDecreased && <span className="absolute -top-2 left-1 text-[9px] bg-orange-100 border border-orange-400 text-orange-600 px-1 rounded shadow-sm">후로 감소 (-1판)</span>}
                              {yaku}
                            </button>
                          );
                        })}
                    </div></div>
                  ))}
                </section>
                <section className="space-y-3"><h3 className="font-bold text-lg text-gray-800 border-b pb-2">도라 / 부수 / 판수</h3>
                  <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-gray-100">
                    <div className="flex justify-between items-center"><span className="font-bold text-yellow-600">도라</span><div className="flex items-center gap-2"><button onClick={() => setDora(Math.max(0, dora - 1))} className="w-7 h-7 bg-gray-100 rounded font-bold">-</button><span className="w-4 text-center font-bold">{dora}</span><button onClick={() => setDora(dora + 1)} className="w-7 h-7 bg-gray-100 rounded font-bold">+</button></div></div>
                    <div className="flex justify-between items-center"><span className="font-bold text-red-500">아카</span><div className="flex items-center gap-2"><button onClick={() => setAka(Math.max(0, aka - 1))} className="w-7 h-7 bg-gray-100 rounded font-bold">-</button><span className="w-4 text-center font-bold">{aka}</span><button onClick={() => setAka(aka + 1)} className="w-7 h-7 bg-gray-100 rounded font-bold">+</button></div></div>
                    <div className="flex justify-between items-center"><span className="font-bold text-orange-400">우라</span><div className="flex items-center gap-2"><button onClick={() => setUra(Math.max(0, ura - 1))} className="w-7 h-7 bg-gray-100 rounded font-bold">-</button><span className="w-4 text-center font-bold">{ura}</span><button onClick={() => setUra(ura + 1)} className="w-7 h-7 bg-gray-100 rounded font-bold">+</button></div></div>
                    <div className="flex justify-between items-center"><span className="font-bold text-blue-500">북</span><div className="flex items-center gap-2"><button onClick={() => setPei(Math.max(0, pei - 1))} className="w-7 h-7 bg-gray-100 rounded font-bold">-</button><span className="w-4 text-center font-bold">{pei}</span><button onClick={() => setPei(pei + 1)} className="w-7 h-7 bg-gray-100 rounded font-bold">+</button></div></div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1 flex justify-between p-3 bg-white rounded-xl border border-gray-100 items-center"><span className="font-bold text-[#2E7D32]">부수</span><div className="flex items-center gap-2"><button onClick={() => setFu(Math.max(20, fu - 10))} className="bg-gray-100 w-8 h-8 rounded font-bold">-</button><span className="font-bold text-lg w-6 text-center">{fu}</span><button onClick={() => setFu(Math.min(110, fu + 10))} className="bg-gray-100 w-8 h-8 rounded font-bold">+</button></div></div>
                    <div className="flex-1 flex justify-between p-3 bg-white rounded-xl border border-gray-100 items-center"><span className="font-bold text-[#2E7D32]">판수</span><div className="flex items-center gap-2"><button onClick={() => setHan(Math.max(1, han - 1))} className="bg-gray-100 w-8 h-8 rounded font-bold">-</button><span className="font-bold text-lg w-4 text-center">{han}</span><button onClick={() => setHan(han + 1)} className="bg-gray-100 w-8 h-8 rounded font-bold">+</button></div></div>
                  </div>
                </section>
              </>
            ) : (
              <>
                <section className="space-y-3"><div className="flex justify-between items-end border-b pb-2"><h3 className="font-bold text-lg text-gray-800">텐파이 플레이어</h3><p className="text-[10px] text-gray-400">선택하지 않으면 전원 노텐</p></div><div className="grid grid-cols-2 gap-3">
                  {players.map((player, index) => <button key={`tenpai-${index}`} onClick={() => toggleTenpai(index)} disabled={abortiveType !== null} className={`h-16 rounded-xl font-bold text-lg transition-all border-2 select-none ${tenpaiPlayers.includes(index) ? 'bg-[#2E7D32] border-[#2E7D32] text-white shadow-inner' : 'bg-white border-gray-200 text-gray-800 hover:border-gray-300 disabled:opacity-50 disabled:bg-gray-100'}`}>{player}</button>)}
                </div></section>
                <section className="space-y-3"><div className="flex justify-between items-end border-b pb-2"><h3 className="font-bold text-lg text-gray-800">유국만관 여부 (선택)</h3></div><div className="grid grid-cols-2 gap-3">
                  {players.map((player, index) => <button key={`nagashi-${index}`} onClick={() => toggleNagashi(index)} disabled={abortiveType !== null} className={`h-12 rounded-xl font-bold transition-all border-2 select-none ${nagashiMangan.includes(index) ? 'bg-orange-500 border-orange-500 text-white shadow-inner' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 disabled:opacity-50 disabled:bg-gray-100'}`}>{player}</button>)}
                </div></section>
                <section className="space-y-3"><div className="flex justify-between items-end border-b pb-2"><h3 className="font-bold text-lg text-gray-800">도중유국 종류 (선택)</h3></div><div className="grid grid-cols-2 gap-2">
                  {abortiveDraws.map(type => <button key={type} onClick={() => toggleAbortive(type)} className={`p-4 rounded-xl text-center font-bold border-2 transition-colors ${abortiveType === type ? 'bg-gray-700 border-gray-700 text-white shadow-inner' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>{type}</button>)}
                </div></section>
              </>
            )}
          </div>
          <div className="p-4 bg-white border-t border-gray-200 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] z-10"><button onClick={handleSaveRound} className={`w-full text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${recordMode === '화료' ? 'bg-[#2E7D32] hover:bg-green-800' : 'bg-gray-700 hover:bg-gray-800'}`}><Check size={20} strokeWidth={3} /> {recordMode === '화료' ? '화료 기록 저장' : '유국 기록 저장'}</button></div>
        </div>
      )}

      {/* 하단 네비게이션 */}
      <nav className="fixed bottom-0 w-full bg-white border-t border-gray-200 flex justify-around p-2 pb-6 z-10">
        <button className={`flex flex-col items-center p-2 transition-colors ${activeNav === '기록' ? 'text-[#2E7D32]' : 'text-gray-400'}`} onClick={() => {setActiveNav('기록'); setSelectedGameId(null);}}><List size={24} /><span className="text-[10px] mt-1 font-bold">대국 기록</span></button>
        <button className={`flex flex-col items-center p-2 transition-colors ${activeNav === '통계' ? 'text-[#2E7D32]' : 'text-gray-400'}`} onClick={() => setActiveNav('통계')}><BarChart2 size={24} /><span className="text-[10px] mt-1 font-bold">통계</span></button>
        <button className={`flex flex-col items-center p-2 transition-colors ${activeNav === '랭킹' ? 'text-[#2E7D32]' : 'text-gray-400'}`} onClick={() => setActiveNav('랭킹')}><Trophy size={24} /><span className="text-[10px] mt-1 font-bold">랭킹</span></button>
      </nav>
    </div>
  );
}

export default App;