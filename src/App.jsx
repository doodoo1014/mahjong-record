import { useState, useRef, useEffect, useMemo } from 'react';
import { Gamepad2, Plus, List, BarChart2, Trophy, ChevronLeft, Check, Trash2, ShieldAlert, Users, X, Flag, Edit, Lock, Unlock, Search, CalendarPlus, Shield, UserCheck, ShieldClose, UserX, MessageSquare, AlertOctagon, PieChart, BarChart, Bell, ArrowUpDown, Swords, Info } from 'lucide-react';
import { supabase } from './supabase';

const yakuData = {
  '1판 역': ['리치', '일발', '멘젠쯔모', '탕야오', '핑후', '이페코', '백', '발', '중', '자풍패', '장풍패', '해저로월', '하저로어', '영상개화', '창깡'],
  '2판 역': ['더블리치', '치또이쯔', '일기통관', '삼색동순', '삼색동각', '또이또이', '산안커', '찬타', '소삼원', '혼노두', '산깡쯔'],
  '3판 역': ['혼일색', '준찬타', '량페코'],
  '6판 역': ['청일색'],
  '역만': ['천화', '지화', '인화', '스안커', '국사무쌍', '대삼원', '구련보등', '소사희', '자일색', '녹일색', '청노두', '스깡쯔', '대차륜', '대죽림', '대수린', '석상삼년'],
  '더블역만': ['대사희', '스안커 단기', '국사무쌍 13면', '순정구련보등', '홍공작', '대칠성']
};

const hasYakuman = (game) => {
  if (!game || !game.rounds) return false;
  return game.rounds.some(r => 
    r.type === '화료' && r.round_wins?.some(w => 
      w.han >= 13 || w.yaku_list?.some(y => yakuData['역만']?.includes(y) || yakuData['더블역만']?.includes(y))
    )
  );
};

const targetFuroYaku = ['일기통관', '삼색동순', '찬타', '준찬타', '혼일색', '청일색'];
const menzenOnlyYaku = ['리치', '일발', '멘젠쯔모', '핑후', '이페코', '더블리치', '치또이쯔', '량페코', '천화', '지화', '인화', '스안커', '국사무쌍', '구련보등', '대차륜', '대죽림', '대수린', '석상삼년', '스안커 단기', '국사무쌍 13면', '순정구련보등', '대칠성'];
const abortiveDraws = ['구종구패', '사풍연타', '사깡유국', '사가리치'];

const getMahjongScore = (han, fu, isDealer, isTsumo, honba = 0, is3Player = false, yakuList = []) => {
  let base = 0;
  let yakumanMulti = 0;

  if (yakuList && yakuList.length > 0) {
    yakuList.forEach(y => {
      if (yakuData['역만']?.includes(y)) yakumanMulti += 1;
      if (yakuData['더블역만']?.includes(y)) yakumanMulti += 2;
    });
  }

  if (yakumanMulti > 0) {
    base = 8000 * yakumanMulti; 
  } else if (han >= 13) {
    base = 8000; 
  } else if (han >= 11) {
    base = 6000;
  } else if (han >= 8) {
    base = 4000;
  } else if (han >= 6) {
    base = 3000;
  } else if (han >= 5) {
    base = 2000;
  } else {
    base = fu * Math.pow(2, han + 2);
    if (base > 2000) base = 2000;
  }
  
  const hb = honba * 100;
  let pureTotal = 0; let display = "";

  if (isDealer) {
    if (isTsumo) { const pay = Math.ceil((base * 2) / 100) * 100; pureTotal = pay * (is3Player ? 2 : 3); display = `${pay + hb} ALL`; }
    else { const pay = Math.ceil((base * 6) / 100) * 100; pureTotal = pay; display = `${pay + hb * (is3Player ? 2 : 3)}`; }
  } else {
    if (isTsumo) { const dPay = Math.ceil((base * 2) / 100) * 100; const ndPay = Math.ceil(base / 100) * 100; pureTotal = dPay + ndPay * (is3Player ? 1 : 2); display = `${ndPay + hb}/${dPay + hb}`; }
    else { const pay = Math.ceil((base * 4) / 100) * 100; pureTotal = pay; display = `${pay + hb * (is3Player ? 2 : 3)}`; }
  }
  return { pureTotal, display };
};

const PlayerSearchInput = ({ wind, selectedId, onChange, players, onAddNewPlayer }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (selectedId) {
      const p = players.find(x => x.id === selectedId);
      if (p) setQuery(p.display_name);
    } else if (!isOpen) {
      setQuery('');
    }
  }, [selectedId, players, isOpen]);

  const filtered = players.filter(p => p.display_name.toLowerCase().includes(query.toLowerCase()));
  const isExactMatch = players.some(p => p.original_name === query.trim() || p.display_name === query.trim());

  const handleAdd = async () => {
    if (!query.trim()) return;
    const newId = await onAddNewPlayer(query);
    if (newId) {
      onChange(newId);
      setIsOpen(false);
    }
  };

  const handleSelect = (id, name) => {
    setQuery(name);
    onChange(id);
    setIsOpen(false);
  };

  return (
    <div className="relative flex-1">
      <input 
        type="text" value={query} 
        onChange={e => { 
          setQuery(e.target.value); 
          setIsOpen(true); 
          if (selectedId) onChange(''); 
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        placeholder={`${wind}가 이름 검색 (없으면 신규 등록)`}
        className="w-full text-sm font-bold outline-none bg-transparent"
      />
      {isOpen && query.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 shadow-xl rounded-lg mt-1 max-h-48 overflow-y-auto z-50">
          {filtered.map(p => (
            <div key={p.id} onMouseDown={e => { e.preventDefault(); handleSelect(p.id, p.display_name); }} className="p-2.5 text-sm font-bold text-gray-800 hover:bg-green-50 cursor-pointer border-b border-gray-100 last:border-b-0">
              {p.display_name}
            </div>
          ))}
          {!isExactMatch && query.trim() !== '' && (
            <div onMouseDown={e => { e.preventDefault(); handleAdd(); }} className="p-2.5 text-sm font-black text-[#2E7D32] hover:bg-green-50 cursor-pointer border-t border-gray-200 bg-green-50/50 flex items-center gap-1">
              <Plus size={14}/> "{query}" 신규 작사 등록
            </div>
          )}
        </div>
      )}
      {isOpen && query.length === 0 && players.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 shadow-xl rounded-lg mt-1 max-h-48 overflow-y-auto z-50">
          {players.map(p => (
            <div key={p.id} onMouseDown={e => { e.preventDefault(); handleSelect(p.id, p.display_name); }} className="p-2.5 text-sm font-bold text-gray-800 hover:bg-green-50 cursor-pointer border-b border-gray-100 last:border-b-0">
              {p.display_name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function App() {
  const [activeTab, setActiveTab] = useState('전체');
  const [activeNav, setActiveNav] = useState('기록');
  const [isLoading, setIsLoading] = useState(true);

  const [games, setGames] = useState([]); 
  const [seasons, setSeasons] = useState([]); 
  const [players, setPlayers] = useState([]);
  
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('mahjong_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login'); 
  const [authName, setAuthName] = useState(''); const [authPin, setAuthPin] = useState(''); const [authRoleReq, setAuthRoleReq] = useState('player'); 
  const [isMasterModalOpen, setIsMasterModalOpen] = useState(false);
  const [allUsers, setAllUsers] = useState([]);

  const canWrite = currentUser ? (currentUser.role === 'master' || currentUser.is_approved || currentUser.is_approved === undefined) : false;
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'master';
  const isMaster = currentUser?.role === 'master';

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const { data: sData } = await supabase.from('seasons').select('*').order('created_at', { ascending: true });
      if (sData) setSeasons(sData);

      const { data: pData } = await supabase.from('players').select('*').eq('is_active', true);
      if (pData) setPlayers(pData);

      const { data: gData } = await supabase
        .from('games')
        .select(`
          *,
          game_results ( id, score, pt, wind, player_id, players(display_name, original_name) ),
          rounds ( id, wind, round_num, honba, kyotaku, type, win_type, multiple_type, loser_id, comment, abortive_type, tenpai_players, nagashi_mangan_players, created_at, is_active, round_wins ( winner_id, han, fu, yaku_list, dora, aka, ura, pei, wait_type, menzen ) )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (gData) {
        gData.forEach(g => { 
          if (g.rounds) {
            g.rounds = g.rounds.filter(r => r.is_active !== false).sort((a,b) => new Date(b.created_at) - new Date(a.created_at)); 
          }
        });
        setGames(gData);
      }

      if (isMaster) {
        const { data: uData } = await supabase.from('users').select('*');
        if (uData) setAllUsers(uData);
      }
    } catch (error) { console.error('로드 에러:', error.message); } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchInitialData(); }, [isMaster]);

  const handleAddNewPlayer = async (rawName) => {
    const name = rawName.trim();
    if (!name) return null;
    
    const { data: existing } = await supabase.from('players').select('suffix').eq('original_name', name);
    let nextSuffix = 'A';
    if (existing && existing.length > 0) {
      const suffixes = existing.map(p => p.suffix).sort();
      nextSuffix = String.fromCharCode(suffixes[suffixes.length - 1].charCodeAt(0) + 1);
    }
    
    const newPlayer = { original_name: name, suffix: nextSuffix, display_name: `${name}${nextSuffix}`, is_active: true };
    const { data, error } = await supabase.from('players').insert([newPlayer]).select().single();
    if (error) { alert("작사 등록 실패: " + error.message); return null; }
    
    setPlayers(prev => [...prev, data]);
    return data.id;
  };

  const handleSignup = async () => {
    if (!authName.trim() || !/^\d{4}$/.test(authPin)) return alert('이름과 4자리 숫자 PIN을 정확히 입력해주세요.');
    const { data: existing } = await supabase.from('users').select('*').eq('username', authName).single();
    if (existing) return alert('이미 존재하는 이름입니다. 로그인해주세요.');
    
    let initialRole = 'player'; let isPending = false; let approved = false;
    if (authName === 'ywc1014') { initialRole = 'master'; approved = true; alert('최고 관리자(마스터) 계정이 생성되었습니다!'); } 
    else if (authRoleReq === 'admin') { isPending = true; alert('가입 완료! 쓰기 및 관리자 권한은 마스터의 승인이 필요합니다.'); } 
    else { alert('가입 완료! 대국 기록을 추가하려면 마스터의 승인이 필요합니다.'); }
    
    const newUser = { username: authName, pin: authPin, role: initialRole, is_approved: approved };
    const { data, error } = await supabase.from('users').insert([newUser]).select().single();
    if (error) return alert("회원가입 오류: " + error.message);
    
    setCurrentUser(data); localStorage.setItem('mahjong_user', JSON.stringify(data));
    setIsAuthModalOpen(false); setAuthName(''); setAuthPin(''); fetchInitialData();
  };

  const handleLogin = async () => {
    if (!authName.trim() || !authPin) return alert('이름과 PIN을 입력해주세요.');
    const { data: user, error } = await supabase.from('users').select('*').eq('username', authName).single();
    if (!user || error) return alert('존재하지 않는 유저입니다. 회원가입을 진행해주세요.');
    if (user.pin !== authPin) return alert('PIN 번호가 일치하지 않습니다.');
    
    setCurrentUser(user); localStorage.setItem('mahjong_user', JSON.stringify(user));
    setIsAuthModalOpen(false); setAuthName(''); setAuthPin('');
  };

  const handleLogout = () => { setCurrentUser(null); localStorage.removeItem('mahjong_user'); };
  const updateRole = async (username, updates) => { await supabase.from('users').update(updates).eq('username', username); fetchInitialData(); };
  
  const [searchQuery, setSearchQuery] = useState('');
  const [gameFilter, setGameFilter] = useState('전체');
  const [selectedSeason, setSelectedSeason] = useState('all'); 
  const [isSeasonModalOpen, setIsSeasonModalOpen] = useState(false);
  const [newSeasonName, setNewSeasonName] = useState(''); const [newSeasonStart, setNewSeasonStart] = useState(''); const [newSeasonEnd, setNewSeasonEnd] = useState('');
  const [editingSeasonId, setEditingSeasonId] = useState(null);

  const handleSaveSeason = async () => {
    if (!newSeasonName.trim()) return alert("시즌 이름을 입력해주세요.");
    const seasonData = { name: newSeasonName, start_date: newSeasonStart || null, end_date: newSeasonEnd || null };
    if (editingSeasonId) await supabase.from('seasons').update(seasonData).eq('id', editingSeasonId);
    else await supabase.from('seasons').insert([seasonData]);
    setNewSeasonName(''); setNewSeasonStart(''); setNewSeasonEnd(''); setEditingSeasonId(null); fetchInitialData();
  };

  const displayedGames = games.filter(g => {
    if (activeTab !== '전체' && g.type !== activeTab) return false;
    if (selectedSeason !== 'all' && g.season_id !== selectedSeason) return false;
    if (searchQuery) {
      const matchDate = g.date?.includes(searchQuery);
      const matchPlayer = g.game_results?.some(r => r.players?.original_name?.includes(searchQuery));
      if (!matchDate && !matchPlayer) return false;
    }
    if (gameFilter === '역만') return hasYakuman(g);
    if (gameFilter === '촌보') return g.rounds?.some(r => r.type === '촌보');
    if (gameFilter === '코멘트') return g.rounds?.some(r => r.comment && r.comment.trim() !== '');
    return true;
  });

  const getTodayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };

  const [selectedGameId, setSelectedGameId] = useState(null); 
  const [isNewGameModalOpen, setIsNewGameModalOpen] = useState(false);
  const [showNewGameMenu, setShowNewGameMenu] = useState(false);
  const [newGameType, setNewGameType] = useState('4인');
  const [newGameDuration, setNewGameDuration] = useState('반장전'); // 💡 동풍전/반장전 상태 추가
  const [newGameDate, setNewGameDate] = useState(getTodayStr()); 
  const [playerE, setPlayerE] = useState(''); const [playerS, setPlayerS] = useState(''); const [playerW, setPlayerW] = useState(''); const [playerN, setPlayerN] = useState('');

  const [isEndGameModalOpen, setIsEndGameModalOpen] = useState(false);
  const [finalScores, setFinalScores] = useState([]);
  
  const [isRoundModalOpen, setIsRoundModalOpen] = useState(false);
  const [recordMode, setRecordMode] = useState('화료'); 
  const [wind, setWind] = useState('동'); const [roundNum, setRoundNum] = useState(1); const [honba, setHonba] = useState(0); const [kyotaku, setKyotaku] = useState(0); 
  const [multipleType, setMultipleType] = useState('단독'); 
  const [loserId, setLoserId] = useState(null); 
  
  const defaultWin = { winnerId: null, winType: '쯔모', waitType: '양면', menzen: '멘젠', dora: 0, aka: 0, ura: 0, pei: 0, fu: 30, han: 1, yaku: [] };
  const [wins, setWins] = useState([{...defaultWin}]);

  const [tenpaiPlayers, setTenpaiPlayers] = useState([]); const [nagashiMangan, setNagashiMangan] = useState([]); const [abortiveType, setAbortiveType] = useState(null); 
  const [roundComment, setRoundComment] = useState(''); const [chomboPlayerId, setChomboPlayerId] = useState(null); 
  const [editingRoundId, setEditingRoundId] = useState(null);

  const currentGame = games.find(g => g.id === selectedGameId);
  const currentParticipants = [...(currentGame?.game_results || [])].sort((a, b) => ({'동': 1, '남': 2, '서': 3, '북': 4}[a.wind] || 5) - ({'동': 1, '남': 2, '서': 3, '북': 4}[b.wind] || 5));
  const rounds = currentGame?.rounds || [];

  const playerTimerRef = useRef(null); const isPlayerLongPressRef = useRef(false);

  const handleWinMethodClick = (method) => {
    if (method === '쯔모') { setMultipleType('단독'); setWins(prev => [{ ...prev[0], winType: '쯔모' }]); setLoserId(null); } 
    else if (method === '론') { setMultipleType('단독'); setWins(prev => [{ ...prev[0], winType: '론' }]); } 
    else if (method === '더블론') { setMultipleType('더블론'); setWins(prev => [{ ...prev[0], winType: '론' }, prev[1] || { ...defaultWin, winType: '론' }]); } 
    else if (method === '트리플론') { setMultipleType('트리플론'); setWins(prev => [{ ...prev[0], winType: '론' }, prev[1] || { ...defaultWin, winType: '론' }, prev[2] || { ...defaultWin, winType: '론' }]); }
  };

  const updateWin = (index, field, value) => { setWins(prev => prev.map((w, i) => i === index ? { ...w, [field]: value } : w)); };

  const toggleWinYaku = (index, yaku) => {
    setWins(prev => prev.map((w, i) => {
      if (i !== index) return w;
      if (w.menzen === '비멘젠' && menzenOnlyYaku.includes(yaku)) return w;
      const newYaku = w.yaku.includes(yaku) ? w.yaku.filter(y => y !== yaku) : [...w.yaku, yaku];
      return { ...w, yaku: newYaku };
    }));
  };

  useEffect(() => {
    if (recordMode !== '화료') return;
    setWins(prev => prev.map(w => {
      let calcHan = 0;
      w.yaku.forEach(yy => {
        if (yakuData['1판 역']?.includes(yy)) calcHan += 1; else if (yakuData['2판 역']?.includes(yy)) calcHan += 2;
        else if (yakuData['3판 역']?.includes(yy)) calcHan += 3; else if (yakuData['6판 역']?.includes(yy)) calcHan += 6;
        else if (yakuData['역만']?.includes(yy)) calcHan += 13; else if (yakuData['더블역만']?.includes(yy)) calcHan += 26;
        if (w.menzen === '비멘젠' && targetFuroYaku.includes(yy)) calcHan -= 1;
      });
      calcHan += w.dora + w.aka + w.ura + (currentGame?.type === '3인' ? w.pei : 0);
      const newHan = calcHan > 0 ? calcHan : 1;
      return w.han !== newHan ? { ...w, han: newHan } : w;
    }));
  }, [wins.map(w => `${w.yaku.join(',')}-${w.dora}-${w.aka}-${w.ura}-${w.pei}-${w.menzen}`).join('|'), currentGame, recordMode]);

  useEffect(() => { setWins(prev => prev.map(w => w.menzen === '비멘젠' ? { ...w, yaku: w.yaku.filter(y => !menzenOnlyYaku.includes(y)) } : w)); }, [wins.map(w => w.menzen).join('|')]);

  const toggleTenpai = (id) => setTenpaiPlayers(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const toggleNagashi = (id) => setNagashiMangan(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const handlePlayerPressStart = (pId) => {
    isPlayerLongPressRef.current = false;
    playerTimerRef.current = setTimeout(() => {
      isPlayerLongPressRef.current = true;
      if (wins[0].winType === '론') {
        setLoserId(pId);
        setWins(prev => prev.map(w => w.winnerId === pId ? { ...w, winnerId: null } : w));
      }
    }, 300);
  };
  const handlePlayerPressEnd = () => { if (playerTimerRef.current) clearTimeout(playerTimerRef.current); };
  
  const handlePlayerClick = (pId) => {
    if (isPlayerLongPressRef.current) return;
    if (multipleType === '단독') { updateWin(0, 'winnerId', pId); } 
    else {
      const existingIdx = wins.findIndex(w => w.winnerId === pId);
      if (existingIdx >= 0) { updateWin(existingIdx, 'winnerId', null); } 
      else {
        const emptyIdx = wins.findIndex(w => w.winnerId === null);
        if (emptyIdx >= 0) updateWin(emptyIdx, 'winnerId', pId);
        else alert(`최대 ${wins.length}명까지 선택 가능합니다.`);
      }
    }
    if (loserId === pId) setLoserId(null);
  };

  const handleCreateNewGame = async () => {
    if (!newGameDate) return alert("일자를 입력해주세요!");
    if (newGameType === '4인' && (!playerE || !playerS || !playerW || !playerN)) return alert("모든 플레이어를 선택해주세요!");
    if (newGameType === '3인' && (!playerE || !playerS || !playerW)) return alert("모든 플레이어를 선택해주세요!");
    
    let matchedSeasonId = null;
    for (let i = seasons.length - 1; i >= 0; i--) { if (seasons[i].start_date && seasons[i].end_date && newGameDate >= seasons[i].start_date && newGameDate <= seasons[i].end_date) { matchedSeasonId = seasons[i].id; break; } }
    if (!matchedSeasonId && seasons.length > 0) matchedSeasonId = seasons[seasons.length - 1].id;

    if (!matchedSeasonId) return alert("우측 상단 달력(+) 아이콘을 눌러 '시즌'을 최소 1개 이상 먼저 만들어주세요!");

    // 💡 duration (반장전/동풍전) DB 삽입 추가
    const { data: newGame, error: gameError } = await supabase.from('games').insert([{ 
      season_id: matchedSeasonId, 
      date: newGameDate, 
      type: newGameType, 
      duration: newGameDuration, 
      status: '진행중' 
    }]).select().single();
    
    if (gameError) return alert("대국 생성 오류: " + gameError.message);

    const participants = [ { game_id: newGame.id, player_id: playerE, wind: '동', score: 0, pt: 0 }, { game_id: newGame.id, player_id: playerS, wind: '남', score: 0, pt: 0 }, { game_id: newGame.id, player_id: playerW, wind: '서', score: 0, pt: 0 } ];
    if (newGameType === '4인') participants.push({ game_id: newGame.id, player_id: playerN, wind: '북', score: 0, pt: 0 });
    
    const { error: resultError } = await supabase.from('game_results').insert(participants);
    if (resultError) return alert("참가자 등록 오류: " + resultError.message);

    setIsNewGameModalOpen(false); setPlayerE(''); setPlayerS(''); setPlayerW(''); setPlayerN(''); setNewGameDuration('반장전'); fetchInitialData();
  };

  const handleOpenGameDetailFromList = (gameId) => { setSelectedGameId(gameId); };

  const handleOpenNewRound = () => {
    try {
      setEditingRoundId(null);
      let nextWind = '동', nextNum = 1, nextHonba = 0;
      if (rounds.length > 0) {
        const last = rounds[0]; const maxRound = currentGame.type === '3인' ? 3 : 4;
        nextWind = last.wind; nextNum = last.round_num; nextHonba = last.honba;
        const dealerId = currentParticipants.find(r => {
          const winds = currentGame.type === '4인' ? ['동','남','서','북'] : ['동','남','서'];
          return winds.indexOf(r.wind) === (last.round_num - 1);
        })?.player_id;

        if (last.type === '화료') { 
          if (last.round_wins?.some(w => w.winner_id === dealerId)) nextHonba++; 
          else { nextHonba = 0; nextNum++; } 
        } else if (last.type === '유국') {
          nextHonba++;
          const isDealerTenpai = (last.tenpai_players || []).includes(dealerId);
          if (!last.abortive_type && !isDealerTenpai) nextNum++;
        }
        
        if (nextNum > maxRound) { 
          nextNum = 1; 
          const winds = currentGame.type === '4인' ? ['동','남','서','북'] : ['동','남','서']; 
          nextWind = winds[(winds.indexOf(nextWind) + 1) % winds.length]; 
        }
      }
      setRecordMode('화료'); setWind(nextWind); setRoundNum(nextNum); setHonba(nextHonba); setKyotaku(0); 
      setMultipleType('단독'); setWins([{...defaultWin}]); setLoserId(null);
      setTenpaiPlayers([]); setNagashiMangan([]); setAbortiveType(null); setRoundComment(''); setChomboPlayerId(null); 
      setIsRoundModalOpen(true);
    } catch(e) {
      alert("국 추가 창을 여는 중 에러 발생: " + e.message);
    }
  };

  const handleEditRound = (record) => {
    setEditingRoundId(record.id);
    setRecordMode(record.type || '화료'); 
    setWind(record.wind || '동'); 
    setRoundNum(record.round_num || 1); 
    setHonba(record.honba || 0); 
    setKyotaku(record.kyotaku || 0);
    
    if (record.type === '화료') {
      setMultipleType(record.multiple_type || '단독');
      const loadedWins = record.round_wins?.map(w => ({
        winnerId: w.winner_id, winType: record.win_type, waitType: w.wait_type, menzen: w.menzen,
        yaku: w.yaku_list || [], dora: w.dora || 0, aka: w.aka || 0, ura: w.ura || 0, pei: w.pei || 0, fu: w.fu || 30, han: w.han || 1
      })) || [];
      setWins(loadedWins.length > 0 ? loadedWins : [{...defaultWin}]);
      setLoserId(record.loser_id || null);
    } else if (record.type === '유국') {
      setTenpaiPlayers(record.tenpai_players || []); setNagashiMangan(record.nagashi_mangan_players || []); setAbortiveType(record.abortive_type || null);
    } else if (record.type === '촌보') {
      setChomboPlayerId(record.loser_id || null);
    }
    setRoundComment(record.comment || '');
    setIsRoundModalOpen(true);
  };

  const handleSaveRound = async () => {
    if (!currentGame || !currentGame.id) return alert("오류: 현재 대국 정보를 찾을 수 없습니다. 창을 닫고 다시 시도해주세요.");
    if (recordMode === '화료') {
      if (wins.some(w => !w.winnerId)) return alert("모든 화료자를 선택해주세요!");
      if (wins[0].winType === '론' && !loserId) return alert("방총자를 선택해주세요!");
    } else if (recordMode === '촌보' && !chomboPlayerId) return alert("촌보자 선택!");

    const roundPayload = { 
      game_id: currentGame.id, wind, round_num: roundNum, honba, kyotaku, type: recordMode, 
      win_type: recordMode === '화료' ? wins[0].winType : null, multiple_type: recordMode === '화료' ? multipleType : '단독', 
      loser_id: recordMode === '화료' && wins[0].winType === '론' ? loserId : (recordMode === '촌보' ? chomboPlayerId : null), 
      comment: roundComment, abortive_type: recordMode === '유국' ? abortiveType : null, 
      tenpai_players: recordMode === '유국' && !abortiveType ? tenpaiPlayers : null, nagashi_mangan_players: recordMode === '유국' && !abortiveType ? nagashiMangan : null 
    };

    try {
      if (editingRoundId) {
        const { error: updErr } = await supabase.from('rounds').update(roundPayload).eq('id', editingRoundId);
        if (updErr) throw updErr;
        
        if (recordMode === '화료') {
          await supabase.from('round_wins').delete().eq('round_id', editingRoundId);
          const winPayloads = wins.map(w => ({ round_id: editingRoundId, winner_id: w.winnerId, han: w.han, fu: w.fu, yaku_list: w.yaku, dora: w.dora, aka: w.aka, ura: w.ura, pei: w.pei, wait_type: w.waitType, menzen: w.menzen }));
          const { error: winErr } = await supabase.from('round_wins').insert(winPayloads);
          if (winErr) throw winErr;
        }
      } else {
        const { data: rData, error: insErr } = await supabase.from('rounds').insert([roundPayload]).select().single();
        if (insErr) throw insErr;
        
        if (recordMode === '화료') {
          const winPayloads = wins.map(w => ({ round_id: rData.id, winner_id: w.winnerId, han: w.han, fu: w.fu, yaku_list: w.yaku, dora: w.dora, aka: w.aka, ura: w.ura, pei: w.pei, wait_type: w.waitType, menzen: w.menzen }));
          const { error: winErr2 } = await supabase.from('round_wins').insert(winPayloads);
          if (winErr2) throw winErr2;
        }
      }

      // 💡 종국된 게임에 새로운 기록을 넣었을 때 자동으로 진행중으로 복구
      if (currentGame.status === '종료') {
        await supabase.from('games').update({ status: '진행중' }).eq('id', currentGame.id);
      }

      setIsRoundModalOpen(false); fetchInitialData();
    } catch (e) { 
      console.error("저장 실패 로그:", e); 
      if (e.message?.includes('rounds_game_id_fkey')) alert(`저장 실패: 대국 ID(${currentGame.id})를 서버에서 인식하지 못했습니다.`);
      else alert(`저장 실패: ${e.message || "데이터베이스 오류"}`);
    }
  };

  const handleDeleteGame = async (e, gameId) => { 
    e.stopPropagation(); 
    if(confirm("대국을 삭제하시겠습니까? (통계에서 숨겨지며 영구 삭제되지 않습니다)")) { 
      await supabase.from('games').update({ is_active: false }).eq('id', gameId); 
      fetchInitialData(); 
    } 
  };
  
  const handleDeleteRound = async (roundId) => { 
    if(confirm("국을 삭제하시겠습니까? (통계에서 제외됩니다)")) { 
      await supabase.from('rounds').update({ is_active: false }).eq('id', roundId); 
      fetchInitialData(); 
    } 
  };

  const handleOpenEndGame = () => { setFinalScores(currentParticipants.map(p => ({ result_id: p.id, player_id: p.player_id, name: p.players?.original_name || p.players?.display_name, score: currentGame.status === '종료' ? String(p.score) : '' }))); setIsEndGameModalOpen(true); };
  const updateFinalScore = (index, value) => { const newScores = [...finalScores]; newScores[index].score = value; setFinalScores(newScores); };
  
  // 💡 수정됨: 동풍전일 경우 우마 절반으로 적용
  const handleConfirmEndGame = async () => {
    if (finalScores.some(f => f.score === '')) return alert("모든 점수 입력 필수!");
    const totalScore = finalScores.reduce((sum, f) => sum + (parseInt(f.score) || 0), 0);
    const expected = currentGame.type === '4인' ? 100000 : 105000;
    if (totalScore !== expected) return alert(`총합 불일치! (${totalScore}/${expected})`);

    const sorted = finalScores.map((f, i) => ({ ...f, s: parseInt(f.score), idx: i })).sort((a,b) => b.s !== a.s ? b.s - a.s : a.idx - b.idx);
    
    const isTonpu = currentGame.duration === '동풍전';

    for (let r=0; r<sorted.length; r++) {
      let basePt = currentGame.type === '4인' ? (sorted[r].s - 30000)/1000 : (sorted[r].s - 40000)/1000;
      let rankBonus = currentGame.type === '4인' ? [50,10,-10,-30][r] : [45,0,-30][r];
      
      // 동풍전은 등수 보상(우마/오카)을 0.5배 곱함
      if (isTonpu) {
        rankBonus = rankBonus * 0.5;
      }
      
      let pt = basePt + rankBonus;
      await supabase.from('game_results').update({ score: sorted[r].s, pt: parseFloat(pt.toFixed(1)) }).eq('id', sorted[r].result_id);
    }
    await supabase.from('games').update({ status: '종료' }).eq('id', selectedGameId);
    setIsEndGameModalOpen(false); fetchInitialData();
  };

  const [statsMainTab, setStatsMainTab] = useState('전체'); 
  const [statsSubTab, setStatsSubTab] = useState('플레이어'); 
  const [statsSearchQuery, setStatsSearchQuery] = useState('');
  const [rankingMainTab, setRankingMainTab] = useState('4인'); 
  const [rankingSortConfig, setRankingSortConfig] = useState({ key: 'totalUma', direction: 'desc' }); 
  const [playerStatTab, setPlayerStatTab] = useState('전체'); 
  const [selectedStatPlayerName, setSelectedStatPlayerName] = useState(null); 
  const [breakdownData, setBreakdownData] = useState(null); 
  const [activeTooltip, setActiveTooltip] = useState(null);

  const getFilteredGamesForStats = (typeTab) => games.filter(g => g.status === '종료' && (typeTab === '전체' || g.type === typeTab) && (selectedSeason === 'all' || g.season_id === selectedSeason));

  const generatePlayerStats = (targetGames) => {
    const stats = {};
    targetGames.forEach(game => {
      const sortedResults = [...(game.game_results || [])].sort((a, b) => b.score - a.score);
      sortedResults.forEach((res, rank) => {
        const pId = res.player_id; const pName = res.players?.original_name || res.players?.display_name || '알수없음';
        if (!stats[pId]) stats[pId] = { id: pId, name: pName, gamesPlayed: 0, gamesPlayed4: 0, gamesPlayed3: 0, totalUma: 0, totalUma4: 0, totalUma3: 0, totalScore: 0, maxScore: -99999, minScore: 99999, ranks: [0,0,0,0], tobiCount: 0, roundsPlayed: 0, winCount: 0, dealInCount: 0, tsumoCount: 0, ronCount: 0, riichiWinCount: 0, damaWinCount: 0, furoWinCount: 0, totalHan: 0, maxHonba: 0, waitTypes: {}, yakus: {}, totalWinScore: 0, winScoreCount: 0, maxWinScore: 0, totalDealInScore: 0, dealInScoreCount: 0, maxDealInScore: 0, chomboCount: 0, yakumanCount: 0, menzenTsumo: 0, menzenRon: 0, furoTsumo: 0, furoRon: 0 };
        stats[pId].gamesPlayed += 1; stats[pId].totalUma += Number(res.pt); 
        if (game.type === '4인') { stats[pId].totalUma4 += Number(res.pt); stats[pId].gamesPlayed4 += 1; }
        if (game.type === '3인') { stats[pId].totalUma3 += Number(res.pt); stats[pId].gamesPlayed3 += 1; }
        stats[pId].totalScore += Number(res.score); stats[pId].ranks[rank] += 1;
        if (res.score > stats[pId].maxScore) stats[pId].maxScore = Number(res.score);
        if (res.score < stats[pId].minScore) stats[pId].minScore = Number(res.score);
        if (res.score < 0) stats[pId].tobiCount += 1;
      });

      game.rounds?.forEach(round => {
        game.game_results.forEach(res => { if (stats[res.player_id]) stats[res.player_id].roundsPlayed += 1; });
        if (round.type === '화료' && round.round_wins?.length > 0) {
          
          let sortedWins = [...round.round_wins];
          if (round.multiple_type !== '단독' && round.loser_id) {
            const winds = game.type === '4인' ? ['동','남','서','북'] : ['동','남','서'];
            const loserWind = game.game_results.find(p => p.player_id === round.loser_id)?.wind;
            const loserIdx = winds.indexOf(loserWind);
            sortedWins.sort((a, b) => {
              const windA = game.game_results.find(p => p.player_id === a.winner_id)?.wind;
              const windB = game.game_results.find(p => p.player_id === b.winner_id)?.wind;
              const distA = (winds.indexOf(windA) - loserIdx + 4) % 4;
              const distB = (winds.indexOf(windB) - loserIdx + 4) % 4;
              return distA - distB;
            });
          }

          sortedWins.forEach((winData, winIndex) => {
            const winnerStat = stats[winData.winner_id];
            const winds = game.type === '4인' ? ['동','남','서','북'] : ['동','남','서'];
            const dealerWind = winds[(round.round_num - 1) % winds.length];
            const isDealer = game.game_results.find(r => r.wind === dealerWind)?.player_id === winData.winner_id;
            const appliedHonba = winIndex === 0 ? round.honba : 0;
            const { pureTotal } = getMahjongScore(winData.han, winData.fu, isDealer, round.win_type === '쯔모', appliedHonba, game.type === '3인', winData.yaku_list);

            if (winnerStat) {
              winnerStat.winCount += 1; winnerStat.totalHan += winData.han;
              if (round.honba > winnerStat.maxHonba) winnerStat.maxHonba = round.honba;
              const isMenzen = winData.menzen === '멘젠';
              if (round.win_type === '쯔모') { winnerStat.tsumoCount += 1; isMenzen ? winnerStat.menzenTsumo++ : winnerStat.furoTsumo++; }
              if (round.win_type === '론') { winnerStat.ronCount += 1; isMenzen ? winnerStat.menzenRon++ : winnerStat.furoRon++; }
              const isRiichi = winData.yaku_list?.includes('리치') || winData.yaku_list?.includes('더블리치');
              if (!isMenzen) winnerStat.furoWinCount += 1; else if (isRiichi) winnerStat.riichiWinCount += 1; else winnerStat.damaWinCount += 1;
              if (winData.han >= 13 || winData.yaku_list?.some(y => yakuData['역만']?.includes(y) || yakuData['더블역만']?.includes(y))) winnerStat.yakumanCount += 1;
              if (winData.wait_type) winnerStat.waitTypes[winData.wait_type] = (winnerStat.waitTypes[winData.wait_type] || 0) + 1;
              winData.yaku_list?.forEach(yaku => { winnerStat.yakus[yaku] = (winnerStat.yakus[yaku] || 0) + 1; });
              if (pureTotal > 0) { winnerStat.totalWinScore += pureTotal; winnerStat.winScoreCount += 1; if (pureTotal > winnerStat.maxWinScore) winnerStat.maxWinScore = pureTotal; }
            }
          });

          if (round.win_type === '론' && round.loser_id && stats[round.loser_id]) {
            const loserStat = stats[round.loser_id];
            loserStat.dealInCount += 1;
            let totalLoss = 0;
            sortedWins.forEach((w, wIndex) => {
              const winds = game.type === '4인' ? ['동','남','서','북'] : ['동','남','서'];
              const dealerWind = winds[(round.round_num - 1) % winds.length];
              const isDealer = game.game_results.find(r => r.wind === dealerWind)?.player_id === w.winner_id;
              const appliedHonba = wIndex === 0 ? round.honba : 0;
              totalLoss += getMahjongScore(w.han, w.fu, isDealer, false, appliedHonba, game.type === '3인', w.yaku_list).pureTotal;
            });
            if (totalLoss > 0) { loserStat.totalDealInScore += totalLoss; loserStat.dealInScoreCount += 1; if (totalLoss > loserStat.maxDealInScore) loserStat.maxDealInScore = totalLoss; }
          }
        } else if (round.type === '촌보') { if (round.loser_id && stats[round.loser_id]) stats[round.loser_id].chomboCount += 1; }
      });
    });

    return Object.values(stats).map(s => {
      const avgRank = s.gamesPlayed > 0 ? ((s.ranks[0]*1 + s.ranks[1]*2 + s.ranks[2]*3 + s.ranks[3]*4) / s.gamesPlayed).toFixed(2) : 0;
      const rentaiCount = s.ranks[0] + s.ranks[1];
      return { ...s, winRate: s.roundsPlayed > 0 ? ((s.winCount / s.roundsPlayed) * 100).toFixed(1) : 0, dealInRate: s.roundsPlayed > 0 ? ((s.dealInCount / s.roundsPlayed) * 100).toFixed(1) : 0, avgHan: s.winCount > 0 ? (s.totalHan / s.winCount).toFixed(1) : 0, avgWinScore: s.winScoreCount > 0 ? Math.floor(s.totalWinScore / s.winScoreCount) : 0, avgUma: s.gamesPlayed > 0 ? (s.totalUma / s.gamesPlayed).toFixed(1) : 0, avgScore: s.gamesPlayed > 0 ? Math.floor(s.totalScore / s.gamesPlayed) : 0, avgDealInScore: s.dealInScoreCount > 0 ? Math.floor(s.totalDealInScore / s.dealInScoreCount) : 0, rank1Count: s.ranks[0], firstRate: s.gamesPlayed > 0 ? ((s.ranks[0] / s.gamesPlayed) * 100).toFixed(1) : 0, rank2Count: s.ranks[1], secondRate: s.gamesPlayed > 0 ? ((s.ranks[1] / s.gamesPlayed) * 100).toFixed(1) : 0, rank3Count: s.ranks[2], thirdRate: s.gamesPlayed > 0 ? ((s.ranks[2] / s.gamesPlayed) * 100).toFixed(1) : 0, rank4Count: s.ranks[3], fourthRate: s.gamesPlayed > 0 ? ((s.ranks[3] / s.gamesPlayed) * 100).toFixed(1) : 0, rentaiRate: s.gamesPlayed > 0 ? ((rentaiCount / s.gamesPlayed) * 100).toFixed(1) : 0, tobiRate: s.gamesPlayed > 0 ? ((s.tobiCount / s.gamesPlayed) * 100).toFixed(1) : 0, avgRank: avgRank, topYakus: Object.entries(s.yakus).sort((a,b) => b[1] - a[1]).slice(0, 5) };
    });
  };

  const statsGames = getFilteredGamesForStats(statsMainTab);
  const playerStatsList = useMemo(() => generatePlayerStats(statsGames).sort((a, b) => { if (a.gamesPlayed4 > 0 && b.gamesPlayed4 === 0) return -1; if (a.gamesPlayed4 === 0 && b.gamesPlayed4 > 0) return 1; if (b.totalUma4 !== a.totalUma4) return b.totalUma4 - a.totalUma4; if (b.totalUma3 !== a.totalUma3) return b.totalUma3 - a.totalUma3; return a.name.localeCompare(b.name); }), [statsGames]);

  const selectedStatPlayer = selectedStatPlayerName ? { name: selectedStatPlayerName } : null;
  const filteredPlayerStatsList = playerStatsList.filter(p => p.name.includes(statsSearchQuery));

  const openBreakdown = (title, type, key) => {
    const rawData = playerStatsList.map(p => { let count = 0; if (type === 'yaku') count = p.yakus[key] || 0; else if (type === 'wait') count = p.waitTypes[key] || 0; else if (type === 'winType') count = p[key] || 0; return { name: p.name, count }; }).filter(p => p.count > 0).sort((a, b) => b.count !== a.count ? b.count - a.count : a.name.localeCompare(b.name));
    let currentRank = 1; const rankedData = rawData.map((item, index, arr) => { if (index > 0 && item.count < arr[index - 1].count) currentRank = index + 1; return { ...item, rank: currentRank }; });
    setBreakdownData({ title, data: rankedData });
  };

  const globalYakuStats = useMemo(() => {
    const yCounts = {};
    statsGames.forEach(g => g.rounds?.forEach(r => { if(r.type === '화료' && r.round_wins) r.round_wins.forEach(w => w.yaku_list?.forEach(y => yCounts[y] = (yCounts[y] || 0) + 1)); }));
    const sorted = Object.entries(yCounts).map(([yaku, count]) => ({ yaku, count })).sort((a, b) => b.count !== a.count ? b.count - a.count : a.yaku.localeCompare(b.yaku));
    let currentRank = 1; return sorted.map((item, index, arr) => { if (index > 0 && item.count < arr[index - 1].count) currentRank = index + 1; return { ...item, rank: currentRank }; });
  }, [statsGames]);

  const globalWinStats = useMemo(() => {
    const w = { menzenTsumo:0, menzenRon:0, furoTsumo:0, furoRon:0, riichi:0, dama:0, furoWin:0, wait: {}, winCount:0 };
    statsGames.forEach(g => g.rounds?.forEach(r => {
      if(r.type === '화료' && r.round_wins) {
        r.round_wins.forEach(winData => {
          w.winCount++; const isMenzen = winData.menzen === '멘젠';
          if (r.win_type === '쯔모') isMenzen ? w.menzenTsumo++ : w.furoTsumo++;
          if (r.win_type === '론') isMenzen ? w.menzenRon++ : w.furoRon++;
          const isRiichi = winData.yaku_list?.includes('리치') || winData.yaku_list?.includes('더블리치');
          if (!isMenzen) w.furoWin++; else if (isRiichi) w.riichi++; else w.dama++;
          if(winData.wait_type) w.wait[winData.wait_type] = (w.wait[winData.wait_type] || 0) + 1;
        });
      }
    }));
    return w;
  }, [statsGames]);

  const requestRankingSort = (key) => { let direction = 'desc'; if (rankingSortConfig.key === key && rankingSortConfig.direction === 'desc') direction = 'asc'; setRankingSortConfig({ key, direction }); };

  const rankingList = useMemo(() => {
    const list = generatePlayerStats(getFilteredGamesForStats(rankingMainTab));
    const sorted = list.sort((a, b) => {
      let valA = a[rankingSortConfig.key]; let valB = b[rankingSortConfig.key];
      if (['firstRate', 'secondRate', 'thirdRate', 'fourthRate', 'rentaiRate', 'tobiRate', 'avgRank', 'avgUma', 'totalUma', 'maxScore', 'minScore', 'gamesPlayed', 'avgScore', 'winCount', 'winRate', 'dealInCount', 'dealInRate', 'avgWinScore', 'maxWinScore', 'avgDealInScore', 'maxDealInScore', 'rank1Count', 'rank2Count', 'rank3Count', 'rank4Count'].includes(rankingSortConfig.key)) { valA = parseFloat(valA); valB = parseFloat(valB); }
      if (valA < valB) return rankingSortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return rankingSortConfig.direction === 'asc' ? 1 : -1;
      if (b.totalUma !== a.totalUma) return b.totalUma - a.totalUma;
      return a.name.localeCompare(b.name);
    });
    let currentRank = 1; return sorted.map((player, index, arr) => { if (index > 0) { let isTie = player[rankingSortConfig.key] === arr[index - 1][rankingSortConfig.key]; if (!isTie) currentRank = index + 1; } return { ...player, rank: currentRank }; });
  }, [games, rankingMainTab, rankingSortConfig, selectedSeason]);

  const [rival1, setRival1] = useState(''); const [rival2, setRival2] = useState('');

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-[#F5F5DC] font-bold text-[#2E7D32]">서버 연결 중...</div>;

  return (
    <div className="flex flex-col h-screen bg-[#F5F5DC] font-sans relative overflow-hidden text-[#1A1A1A]">
      <header className="bg-[#2E7D32] text-white p-4 pt-10 shadow-md z-20 shrink-0">
        <div className="flex items-center justify-between mb-3 min-h-[36px]">
          {selectedGameId ? (
            <div className="flex items-center w-full"><button onClick={() => setSelectedGameId(null)} className="p-1 hover:bg-green-700 rounded-full absolute left-4"><ChevronLeft size={28}/></button><h1 className="text-xl font-bold w-full text-center pr-4">대국 상세 기록</h1></div>
          ) : (
            <>
              <h1 className="text-xl font-bold tracking-tight">{activeNav === '기록' ? '리치마작 기록' : activeNav === '통계' ? '마작 통계' : activeNav === '랭킹' ? '플레이어 랭킹' : activeNav === '라이벌' ? '라이벌 전적' : '설정'}</h1>
              <div className="flex items-center gap-1.5">
                {currentUser ? (
                  <>
                    <span className="text-[10px] font-medium bg-green-800 px-2 py-1 rounded-lg">{currentUser.role === 'master' ? '👑' : currentUser.role === 'admin' ? '🛡️' : '♟️'} {currentUser.username}</span>
                    {isAdmin && <button onClick={() => setIsSeasonModalOpen(true)} className="p-1.5 bg-green-800 rounded-lg hover:bg-green-900"><CalendarPlus size={16}/></button>}
                    {isMaster && <button onClick={() => setIsMasterModalOpen(true)} className="p-1.5 bg-yellow-600 rounded-lg hover:bg-yellow-700"><Users size={16}/></button>}
                    <button onClick={handleLogout} className="p-1.5 bg-green-800 text-yellow-300 rounded-lg"><Unlock size={16}/></button>
                  </>
                ) : (
                  <button onClick={() => {setAuthMode('login'); setIsAuthModalOpen(true);}} className="p-1.5 bg-green-800 rounded-lg flex items-center gap-1 text-sm font-medium"><Lock size={14}/><span className="text-[10px]">로그인</span></button>
                )}
              </div>
            </>
          )}
        </div>
        {!selectedGameId && (
          <select value={selectedSeason} onChange={e=>setSelectedSeason(e.target.value)} className="w-full bg-green-800 text-white text-sm font-bold py-2 px-3 rounded-xl appearance-none border border-green-700 focus:outline-none">
            <option value="all">전체 시즌</option>{seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </header>

      <main className="flex-1 overflow-y-auto flex flex-col relative pb-24">
        
        {/* === 게임 리스트 화면 === */}
        {activeNav === '기록' && selectedGameId === null && (
          <>
            <div className="flex bg-white border-b border-gray-200 shadow-sm shrink-0">
              {['전체','4인','3인'].map(t => (
                <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-3 font-bold border-b-2 ${activeTab === t ? 'border-[#2E7D32] text-[#2E7D32]' : 'border-transparent text-gray-500'}`}>
                  {t} 게임 <span className={`text-[10px] px-2 py-0.5 rounded-full text-white ${activeTab === t ? 'bg-[#2E7D32]' : 'bg-gray-300'}`}>{t === '전체' ? games.length : games.filter(g => g.type === t).length}</span>
                </button>
              ))}
            </div>
            <div className="px-4 pt-4 shrink-0 space-y-3">
              <div className="relative"><div className="absolute inset-y-0 left-0 pl-3 flex items-center"><Search size={16} className="text-gray-400"/></div><input type="text" placeholder="검색..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-[#2E7D32] shadow-sm"/></div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">{['전체','역만','촌보','코멘트'].map(f => <button key={f} onClick={() => setGameFilter(f)} className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border shadow-sm ${gameFilter === f ? 'bg-[#2E7D32] text-white border-[#2E7D32]' : 'bg-white text-gray-600 border-gray-200'}`}>{f === '역만' && '🔥 '}{f === '촌보' && '⚠️ '}{f === '코멘트' && '💬 '}{f}</button>)}</div>
            </div>
            
            <div className="flex-1 p-4 space-y-4">
              {displayedGames.length === 0 ? (
                <div className="mt-20 text-center text-gray-400"><Gamepad2 size={64} className="mx-auto mb-4 opacity-50"/><h2 className="text-lg font-bold">검색된 대국 기록이 없습니다</h2>{canWrite ? <p className="text-xs mt-2">우측 하단 + 버튼으로 새 대국을 만드세요</p> : currentUser ? <p className="text-xs font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 mt-2">쓰기 권한 승인 대기 중입니다</p> : <p className="text-xs mt-2">우측 상단 로그인 후 기록을 추가할 수 있습니다</p>}</div>
              ) : (
               displayedGames.map(game => {
                 const isY = hasYakuman(game); const hasC = game.rounds?.some(r => r.type === '촌보');
                 const playerYakuman = (pId) => game.rounds?.some(r => r.type === '화료' && r.round_wins?.some(w => w.winner_id === pId && (w.han >= 13 || w.yaku_list?.some(y => yakuData['역만']?.includes(y) || yakuData['더블역만']?.includes(y)))));
                 const playerChombo = (pId) => game.rounds?.some(r => r.type === '촌보' && r.loser_id === pId);
                 let cardClass = "bg-white border-gray-100"; if (isY && hasC) cardClass = "bg-gray-300 border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]"; else if (isY) cardClass = "bg-white border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]"; else if (hasC) cardClass = "bg-gray-300 border-gray-400";
                 return (
                   <div key={game.id} onClick={() => handleOpenGameDetailFromList(game.id)} className={`p-4 rounded-[20px] shadow-sm relative cursor-pointer border hover:shadow-md transition-shadow active:scale-[0.98] ${cardClass}`}>
                     {isY && <span className="absolute -top-3 -right-2 bg-gradient-to-r from-red-500 to-yellow-500 text-white text-[10px] font-black px-2 py-1 rounded-full animate-pulse shadow-md">역만🔥</span>}
                     <div className="flex justify-between items-center mb-1">
                       <span className="text-xs font-medium text-gray-400">{game.date}</span>
                       <div className="flex gap-1.5">
                         {/* 💡 대국 목록 카드에 동풍/반장전 표시 추가 */}
                         <span className="text-[10px] font-bold px-2 py-1 rounded text-gray-600 bg-gray-100">{game.duration || '반장전'}</span>
                         <span className={`text-[10px] font-bold px-2 py-1 rounded ${game.status === '종료' ? 'text-gray-600 bg-gray-100' : 'text-[#2E7D32] bg-green-50'}`}>{game.rounds?.length || 0}국</span>
                         <span className={`text-[10px] font-bold px-2 py-1 rounded ${game.status === '종료' ? 'text-gray-500 bg-gray-200' : 'text-[#2E7D32] bg-green-50'}`}>{game.status}</span>
                       </div>
                     </div>
                     <div className="flex justify-between items-center mb-3"><h3 className="font-bold text-base text-gray-800 truncate pr-4">{game.game_results.map(r => r.players?.original_name || r.players?.display_name).join(' · ')}</h3>{canWrite && <button onClick={e => handleDeleteGame(e, game.id)} className="text-red-300 hover:text-red-500 p-1"><Trash2 size={16} /></button>}</div>
                     <div className="grid gap-2 mt-2 grid-cols-2">
                       {/* 💡 수정: 대국 리스트의 카드에서도 동-남-서-북 순서로 강제 정렬 후 렌더링 */}
                       {[...game.game_results].sort((a, b) => ({'동': 1, '남': 2, '서': 3, '북': 4}[a.wind] || 5) - ({'동': 1, '남': 2, '서': 3, '북': 4}[b.wind] || 5)).map(res => {
                         const pId = res.player_id; const isTobi = game.status === '종료' && res.score < 0; const hasYPlayer = playerYakuman(pId); const hasCPlayer = playerChombo(pId);
                         let boxBg = 'bg-white'; let boxBorder = 'border border-gray-100'; let windBg = 'bg-[#2E7D32]'; let nameColor = 'text-gray-800';
                         if (hasYPlayer && hasCPlayer) { boxBg = 'bg-white'; boxBorder = 'border-2 border-gray-600'; windBg = 'bg-red-600'; nameColor = 'text-gray-800'; } else if (hasCPlayer) { boxBg = 'bg-white'; boxBorder = 'border-2 border-gray-600'; windBg = 'bg-gray-600'; nameColor = 'text-gray-800'; } else if (hasYPlayer) { boxBg = 'bg-white'; boxBorder = 'border-2 border-red-500'; windBg = 'bg-red-600'; nameColor = 'text-gray-800'; }
                         if (isTobi) { boxBg = 'bg-gray-100'; nameColor = 'text-gray-400'; windBg = 'bg-gray-400'; } else if (game.status !== '종료') { boxBg = 'bg-gray-50'; }
                         return (
                           <div key={res.player_id} className={`flex items-center justify-between p-2 rounded-xl shadow-sm ${boxBg} ${boxBorder}`}>
                             <div className="flex items-center gap-1.5"><div className={`text-white w-6 h-6 min-w-[24px] rounded flex items-center justify-center font-bold text-xs ${windBg}`}>{res.wind}</div><span className={`text-sm font-bold truncate ${nameColor}`}>{res.players?.original_name || res.players?.display_name}</span></div>
                             {game.status === '종료' && <div className="flex flex-col items-end pr-1"><span className={`text-sm font-black ${res.pt > 0 ? 'text-[#2E7D32]' : res.pt < 0 ? 'text-red-500' : 'text-gray-400'}`}>{res.pt > 0 ? '+' : ''}{res.pt}</span><span className={`text-[10px] font-bold mt-0.5 ${isTobi ? 'text-gray-300' : 'text-gray-400'}`}>{Number(res.score).toLocaleString()}</span></div>}
                           </div>
                         );
                       })}
                     </div>
                   </div>
                 );
               })
              )}
              {canWrite && (
                <div className="fixed bottom-20 right-6 z-20 flex flex-col items-end">
                  {showNewGameMenu && (
                    <div className="flex flex-col gap-2 mb-3 animate-in slide-in-from-bottom-2 fade-in zoom-in duration-200">
                      <button onClick={() => {setNewGameType('4인'); setIsNewGameModalOpen(true); setShowNewGameMenu(false);}} className="bg-white text-[#2E7D32] font-black text-sm px-5 py-3 rounded-full shadow-lg flex items-center gap-2 border border-gray-100 hover:bg-gray-50"><Users size={16}/> 4인 대국 시작</button>
                      <button onClick={() => {setNewGameType('3인'); setIsNewGameModalOpen(true); setShowNewGameMenu(false);}} className="bg-white text-[#2E7D32] font-black text-sm px-5 py-3 rounded-full shadow-lg flex items-center gap-2 border border-gray-100 hover:bg-gray-50"><Users size={16}/> 3인 대국 시작</button>
                    </div>
                  )}
                  <button onClick={() => {if(activeTab === '전체') setShowNewGameMenu(!showNewGameMenu); else {setNewGameType(activeTab); setIsNewGameModalOpen(true);}}} className={`bg-[#2E7D32] text-white p-4 rounded-full shadow-lg hover:bg-green-800 transition-transform active:scale-95 ${showNewGameMenu ? 'rotate-45' : ''}`}><Plus size={28} strokeWidth={3}/></button>
                </div>
              )}
            </div>
          </>
        )}

        {/* === 대국 상세 화면 === */}
        {activeNav === '기록' && selectedGameId !== null && currentGame && (
          <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right">
            <div className="bg-white border-b border-gray-200 grid grid-cols-4 divide-x divide-gray-100 text-center py-2.5 shadow-sm z-10 shrink-0">
              <div className="flex flex-col"><span className="text-lg font-black text-[#2E7D32]">{rounds.length}</span><span className="text-[9px] text-gray-500 font-bold">총 기록</span></div>
              <div className="flex flex-col"><span className="text-lg font-black text-[#2E7D32]">{rounds.filter(r => r.win_type === '쯔모').length}</span><span className="text-[9px] text-gray-500 font-bold">쯔모</span></div>
              <div className="flex flex-col"><span className="text-lg font-black text-orange-500">{rounds.filter(r => r.win_type === '론').length}</span><span className="text-[9px] text-gray-500 font-bold">론</span></div>
              <div className="flex flex-col"><span className="text-lg font-black text-gray-500">{rounds.filter(r => r.type === '유국').length}</span><span className="text-[9px] text-gray-500 font-bold">유국</span></div>
            </div>

            <div className="p-4 pb-0">
              <div className="bg-white p-3 rounded-xl border border-gray-200 flex justify-between items-center text-sm font-bold shadow-sm">
                {currentParticipants.map((res, i) => (
                  <div key={res.player_id} className={`text-center flex-1 flex flex-col items-center ${i > 0 ? 'border-l border-gray-200' : ''}`}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[13px] mb-1.5 shadow-sm bg-[#2E7D32]">{res.wind}</div>
                    <span className="block text-gray-800">{res.players?.original_name || res.players?.display_name}</span>
                  </div>
                ))}
              </div>
              
              {currentGame.status === '종료' ? (
                <div className="bg-[#1e293b] text-white rounded-xl p-4 mt-4 relative shadow-lg">
                  {canWrite && <button onClick={handleOpenEndGame} className="absolute top-3 right-3 text-[10px] font-bold bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded flex items-center gap-1 transition-colors"><Edit size={10}/> 수정</button>}
                  <h3 className="font-bold text-base mb-3 flex items-center gap-2"><Trophy size={16} className="text-yellow-400"/> 대국 결과</h3>
                  <div className="space-y-1.5">
                    {currentParticipants.map(res => (
                      <div key={res.player_id} className="flex justify-between items-center py-1.5 border-b border-gray-700 last:border-0 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold bg-gray-600 text-white">{res.wind}</div>
                          <span className="font-bold">{res.players?.original_name || res.players?.display_name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="w-16 font-medium text-gray-300 text-xs text-right">{Number(res.score).toLocaleString()}</span>
                          <span className={`w-12 font-black text-right ${res.pt > 0 ? 'text-green-400' : res.pt < 0 ? 'text-red-400' : 'text-gray-400'}`}>{res.pt > 0 ? '+' : ''}{res.pt}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : canWrite && (
                <button onClick={handleOpenEndGame} className="w-full bg-[#1e293b] text-white font-bold py-3.5 rounded-xl mt-4 flex justify-center items-center gap-2 shadow-md text-sm hover:bg-gray-800"><Flag size={16}/> 대국 종료 및 점수 입력</button>
              )}
            </div>

            <div className="p-4 space-y-3 pb-24">
              {rounds.length === 0 ? <div className="text-center py-10 text-gray-400 font-bold"><p>우측 하단의 + 버튼을 눌러 첫 국을 기록하세요!</p></div> : 
                rounds.map(r => {
                  const isRoundYakuman = r.type === '화료' && r.round_wins?.some(w => w.han >= 13 || w.yaku_list?.some(y => yakuData['역만']?.includes(y) || yakuData['더블역만']?.includes(y)));
                  
                  let sortedWins = [];
                  if (r.type === '화료' && r.round_wins?.length > 0) {
                    sortedWins = [...r.round_wins];
                    if (r.multiple_type !== '단독' && r.loser_id) {
                      const winds = currentGame.type === '4인' ? ['동','남','서','북'] : ['동','남','서'];
                      const loserWind = currentParticipants.find(p => p.player_id === r.loser_id)?.wind;
                      const loserIdx = winds.indexOf(loserWind);
                      sortedWins.sort((a, b) => {
                        const windA = currentParticipants.find(p => p.player_id === a.winner_id)?.wind;
                        const windB = currentParticipants.find(p => p.player_id === b.winner_id)?.wind;
                        const distA = (winds.indexOf(windA) - loserIdx + 4) % 4;
                        const distB = (winds.indexOf(windB) - loserIdx + 4) % 4;
                        return distA - distB;
                      });
                    }
                  }

                  return (
                    <div key={r.id} className={`rounded-xl shadow-sm relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 ${isRoundYakuman ? 'border-2 border-red-500 bg-white shadow-[0_0_10px_rgba(239,68,68,0.2)]' : r.type === '촌보' ? 'bg-gray-200 border-gray-100' : r.type === '유국' ? 'bg-gray-50 border border-gray-300' : 'bg-white border border-gray-100'}`}>
                      <div className={`px-3 py-2 border-b flex justify-between items-center ${isRoundYakuman ? 'bg-red-50 border-red-100' : r.type === '촌보' ? 'bg-gray-400 border-gray-500' : r.type === '유국' ? 'bg-gray-200 border-gray-300' : 'bg-gray-100 border-gray-200'}`}>
                        <span className={`font-bold text-sm ${r.type === '촌보' ? 'text-gray-800' : isRoundYakuman ? 'text-red-800' : 'text-gray-700'}`}>
                          {r.wind}{r.round_num}국 {r.honba > 0 && `${r.honba}본장`}
                          {r.type === '유국' && ' (유국)'} {r.type === '촌보' && ' (촌보)'} {isRoundYakuman && ' - 역만 등장'}
                          {r.multiple_type === '더블론' && ' (더블론)'} {r.multiple_type === '트리플론' && ' (트리플론)'}
                        </span>
                        {canWrite && (
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleEditRound(r)} className={`transition-colors ${r.type === '촌보' ? 'text-gray-800' : 'text-gray-400 hover:text-gray-500'}`}><Edit size={14}/></button>
                            <button onClick={() => handleDeleteRound(r.id)} className={`transition-colors ${r.type === '촌보' ? 'text-gray-800' : 'text-gray-400 hover:text-red-500'}`}><Trash2 size={14}/></button>
                          </div>
                        )}
                      </div>
                      
                      <div className="p-3 pt-2.5">
                        {r.type === '화료' && sortedWins.length > 0 && (
                          <div className="space-y-3">
                            {sortedWins.map((winData, winIndex) => {
                              let rankText = '';
                              let yakumanMulti = 0;
                              winData.yaku_list?.forEach(y => {
                                if (yakuData['역만']?.includes(y)) yakumanMulti += 1;
                                if (yakuData['더블역만']?.includes(y)) yakumanMulti += 2;
                              });

                              if (yakumanMulti > 0) rankText = `${yakumanMulti}배 역만`;
                              else if (winData.han >= 13) rankText = `헤아림 역만 (${winData.han}판)`;
                              else if (winData.han >= 11) rankText = `삼배만 (${winData.han}판)`;
                              else if (winData.han >= 8) rankText = `배만 (${winData.han}판)`;
                              else if (winData.han >= 6) rankText = `하네만 (${winData.han}판)`;
                              else if (winData.han >= 5) rankText = `만관 (${winData.han}판)`;
                              else if ((winData.han === 4 && winData.fu >= 40) || (winData.han === 3 && winData.fu >= 70)) rankText = `만관 (${winData.han}판 ${winData.fu}부)`;
                              else rankText = `${winData.han}판 ${winData.fu}부`;

                              let displayScore = "";
                              if (currentGame.status === '종료') {
                                const winds = currentGame.type === '4인' ? ['동','남','서','북'] : ['동','남','서'];
                                const dealerWind = winds[(r.round_num - 1) % winds.length];
                                const isDealer = currentParticipants.find(p => p.wind === dealerWind)?.player_id === winData.winner_id;
                                const appliedHonba = winIndex === 0 ? r.honba : 0;
                                const { display } = getMahjongScore(winData.han, winData.fu, isDealer, r.win_type === '쯔모', appliedHonba, currentGame.type === '3인', winData.yaku_list);
                                displayScore = display;
                              }

                              return (
                                <div key={winData.winner_id} className={`${winIndex > 0 ? 'pt-3 border-t border-gray-100' : ''}`}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className={`font-bold text-[11px] ${r.win_type === '쯔모' ? 'text-[#2E7D32]' : 'text-orange-500'}`}>{r.win_type}</span>
                                    <span className="font-bold text-sm text-gray-800">
                                      {currentParticipants.find(p => p.player_id === winData.winner_id)?.players?.original_name || '알수없음'}
                                      {r.win_type === '론' && <span className="text-gray-400 text-xs font-medium mx-1">→ {currentParticipants.find(p => p.player_id === r.loser_id)?.players?.original_name || '알수없음'}</span>}
                                    </span>
                                    <span className="ml-auto font-black text-[#2E7D32] text-xs">{displayScore}</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1 mb-1.5">
                                    <span className="bg-gray-100 text-gray-600 text-[9px] px-1.5 py-0.5 rounded font-bold">{winData.wait_type}</span>
                                    <span className="bg-gray-100 text-gray-600 text-[9px] px-1.5 py-0.5 rounded font-bold">{winData.menzen}</span>
                                    {winData.yaku_list?.map(yaku => (
                                      <span key={yaku} className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${isRoundYakuman ? 'bg-red-100 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-100'}`}>
                                        {yaku} {winData.menzen === '비멘젠' && targetFuroYaku.includes(yaku) && '(-1판)'}
                                      </span>
                                    ))}
                                    {(winData.dora + winData.aka + winData.ura + winData.pei) > 0 && (
                                      <span className="bg-amber-50 text-amber-600 text-[9px] px-1.5 py-0.5 rounded font-bold border border-amber-200">
                                        도라 {winData.dora + winData.aka + winData.ura + winData.pei}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-gray-400 font-bold mt-1">{rankText}</div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        
                        {r.type === '유국' && (
                          <div className="space-y-1.5 mt-1">
                            <div className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                              {r.abortive_type ? `도중유국 (${r.abortive_type})` : <><AlertOctagon size={14} className="text-gray-600" />황패유국</>}
                            </div>
                            {!r.abortive_type && (
                              <div className="text-[11px] font-bold text-gray-600 mt-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-gray-500">텐파이:</span>
                                  {r.tenpai_players?.length > 0 ? (
                                    r.tenpai_players.map(id => <span key={id} className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-200">{currentParticipants.find(p => p.player_id === id)?.players?.original_name}</span>)
                                  ) : (
                                    <span className="text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">전원 노텐</span>
                                  )}
                                </div>
                                {r.nagashi_mangan_players?.length > 0 && (
                                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                    <span className="text-gray-500">유국만관:</span>
                                    {r.nagashi_mangan_players.map(id => <span key={id} className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-200">{currentParticipants.find(p => p.player_id === id)?.players?.original_name}</span>)}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {r.type === '촌보' && <div className="text-sm font-bold text-red-600 flex items-center gap-1.5"><AlertOctagon size={14}/> {currentParticipants.find(p => p.player_id === r.loser_id)?.players?.original_name} 촌보</div>}
                        {r.comment && <div className={`mt-2 pt-2 border-t text-[10px] font-medium flex gap-1 ${r.type === '촌보' ? 'border-gray-800 border-opacity-20 text-gray-800' : 'border-gray-100 border-opacity-50 text-gray-500'}`}><MessageSquare size={12} className="mt-0.5 opacity-70"/>{r.comment}</div>}
                      </div>
                    </div>
                  );
                })
              }
            </div>
            {/* 💡 수정됨: currentGame.status === '진행중' 제약 삭제. 종국한 게임도 항상 + 버튼 노출 */}
            {canWrite && <div className="fixed bottom-24 right-6 z-20"><button onClick={handleOpenNewRound} className="bg-[#2E7D32] text-white p-4 rounded-full shadow-lg hover:bg-green-800 active:scale-95 transition-transform"><Plus size={28} strokeWidth={3}/></button></div>}
          </div>
        )}

        {/* === 통계 화면 === */}
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

       {/* === 랭킹 화면 === */}
        {activeNav === '랭킹' && (
          <div className="flex-1 flex flex-col bg-[#F5F5DC]">
            <div className="flex bg-white border-b border-gray-200 shadow-sm z-10 shrink-0 text-sm">
              {['4인', '3인'].map(t => (
                <button key={t} onClick={() => setRankingMainTab(t)} className={`flex-1 py-3 font-bold ${rankingMainTab === t ? 'bg-[#2E7D32] text-white' : 'text-gray-500 bg-gray-50 border-b-2 border-gray-200 hover:bg-gray-100'}`}>{t} 순위</button>
              ))}
            </div>
            
            <div className="p-4 space-y-4 flex-1 flex flex-col">
              <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between shrink-0">
                <span className="text-xs font-bold text-gray-500 flex items-center gap-1"><BarChart2 size={14}/> 테이블 헤더를 터치하여 정렬하세요</span>
              </div>

              {rankingList.length === 0 ? (
                <div className="text-center py-20 text-gray-400 font-bold bg-white rounded-2xl shadow-sm border border-gray-100"><Trophy size={48} className="mx-auto mb-4 text-gray-300" /><p>아직 종료된 대국이 없어</p><p>순위를 매길 수 없습니다.</p></div>
              ) : (
                <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200 relative pb-2 mb-24">
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
                          <td className="sticky left-0 p-3 border-r border-gray-200 font-bold text-gray-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] cursor-pointer hover:text-[#2E7D32] underline decoration-green-300 decoration-2 underline-offset-4" style={{ backgroundColor: idx % 2 === 1 ? '#f9fafb' : '#ffffff' }} onClick={() => { setSelectedStatPlayerName(player.name); setPlayerStatTab(rankingMainTab); }}>
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
                          <td className="p-3 font-medium text-gray-600">{player.maxScore === -99999 ? 0 : Number(player.maxScore).toLocaleString()}</td>
                          <td className="p-3 font-medium text-gray-600">{player.minScore === 99999 ? 0 : Number(player.minScore).toLocaleString()}</td>
                          <td className="p-3 font-medium text-gray-600">{player.winCount}</td>
                          <td className="p-3 font-bold text-[#2E7D32]">{player.winRate}%</td>
                          <td className="p-3 font-medium text-gray-600">{player.dealInCount}</td>
                          <td className="p-3 font-bold text-orange-500">{player.dealInRate}%</td>
                          <td className="p-3 font-bold text-[#2E7D32]">{Number(player.avgWinScore).toLocaleString()}</td>
                          <td className="p-3 font-bold text-[#2E7D32]">{player.maxWinScore > 0 ? Number(player.maxWinScore).toLocaleString() : 0}</td>
                          <td className="p-3 font-bold text-orange-500">{Number(player.avgDealInScore).toLocaleString()}</td>
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

        {/* === 라이벌 화면 === */}
        {activeNav === '라이벌' && (() => {
          const uniquePlayers = Array.from(new Set(
            games.flatMap(g => g.game_results?.map(r => r.players?.original_name || r.players?.display_name))
          )).filter(Boolean).sort();
          
          const rivalGames = games.filter(g => {
            if (g.status !== '종료') return false;
            if (selectedSeason !== 'all' && g.season_id !== selectedSeason) return false;
            const playerNames = g.game_results?.map(r => r.players?.original_name || r.players?.display_name);
            return playerNames?.includes(rival1) && playerNames?.includes(rival2) && rival1 !== rival2;
          });
          
          let p1Wins = 0, p2Wins = 0;
          let p1RonP2 = 0, p2RonP1 = 0;
          let p1RonP2Max = 0, p1RonP2Min = 99999;
          let p2RonP1Max = 0, p2RonP1Min = 99999;

          if (rival1 && rival2 && rivalGames.length > 0) {
            rivalGames.forEach(g => {
              const p1Res = g.game_results.find(r => (r.players?.original_name || r.players?.display_name) === rival1);
              const p2Res = g.game_results.find(r => (r.players?.original_name || r.players?.display_name) === rival2);
              
              if (p1Res && p2Res) {
                if (Number(p1Res.score) > Number(p2Res.score)) p1Wins++;
                else if (Number(p2Res.score) > Number(p1Res.score)) p2Wins++;

                g.rounds?.forEach(r => {
                  if (r.type === '화료' && r.win_type === '론' && r.round_wins?.length > 0) {
                    r.round_wins.forEach(winData => {
                      const winnerName = g.game_results.find(res => res.player_id === winData.winner_id)?.players?.original_name;
                      const loserName = g.game_results.find(res => res.player_id === r.loser_id)?.players?.original_name;
                      
                      if (winnerName && loserName) {
                        const winds = g.type === '4인' ? ['동','남','서','북'] : ['동','남','서'];
                        const dealerWind = winds[(r.round_num - 1) % winds.length];
                        const isDealer = g.game_results.find(res => res.wind === dealerWind)?.player_id === winData.winner_id;
                        const { pureTotal } = getMahjongScore(winData.han, winData.fu, isDealer, false, 0, g.type === '3인', winData.yaku_list);

                        if (winnerName === rival1 && loserName === rival2) {
                          p1RonP2++;
                          if (pureTotal > p1RonP2Max) p1RonP2Max = pureTotal;
                          if (pureTotal < p1RonP2Min) p1RonP2Min = pureTotal;
                        }
                        if (winnerName === rival2 && loserName === rival1) {
                          p2RonP1++;
                          if (pureTotal > p2RonP1Max) p2RonP1Max = pureTotal;
                          if (pureTotal < p2RonP1Min) p2RonP1Min = pureTotal;
                        }
                      }
                    });
                  }
                });
              }
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
                  <div className="bg-[#1e293b] text-white p-4 rounded-2xl shadow-lg flex justify-center items-center gap-6">
                    <div className="text-center flex-1"><span className="block text-2xl font-black">{p1Wins}승</span><span className="text-[10px] text-gray-400">{rival1} 우위</span></div>
                    <div className="flex flex-col items-center"><span className="text-xs font-bold text-gray-400 bg-gray-800 px-3 py-1 rounded-full">총 {rivalGames.length}국 동탁</span></div>
                    <div className="text-center flex-1"><span className="block text-2xl font-black">{p2Wins}승</span><span className="text-[10px] text-gray-400">{rival2} 우위</span></div>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-3 bg-gray-50 border-b border-gray-100 text-center font-bold text-sm text-gray-700">🩸 직접 타격 (방총)</div>
                    <div className="flex p-4 items-center justify-between">
                      <div className="text-center w-[45%]">
                        <span className="block text-[11px] font-bold text-gray-600 mb-2 bg-gray-100 py-1.5 rounded-lg border border-gray-200">{rival1} <span className="text-black-400">→</span> {rival2}</span>
                        <span className="text-2xl font-black text-gray-800">{p1RonP2}회</span>
                        <div className="mt-3 space-y-1 bg-gray-50 p-2 rounded-lg border border-gray-100">
                          <div className="text-[10px] text-gray-500 flex justify-between px-1"><span className="font-bold">최고 타점</span><span className="font-black text-[#2E7D32]">{p1RonP2Max > 0 ? p1RonP2Max.toLocaleString() : 0}점</span></div>
                          <div className="text-[10px] text-gray-500 flex justify-between px-1"><span className="font-bold">최저 타점</span><span className="font-black text-[#2E7D32]">{p1RonP2Min !== 99999 ? p1RonP2Min.toLocaleString() : 0}점</span></div>
                        </div>
                      </div>

                      <div className="w-[10%] text-center text-gray-300 flex justify-center"><Swords size={24} strokeWidth={1.5}/></div>
                      
                      <div className="text-center w-[45%]">
                        <span className="block text-[11px] font-bold text-gray-600 mb-2 bg-gray-100 py-1.5 rounded-lg border border-gray-200">{rival2} <span className="text-black-500">→</span> {rival1}</span>
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

        {/* === 업데이트 화면 === */}
        {activeNav === '업데이트' && (
          <div className="flex-1 flex flex-col p-4 space-y-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                <span className="font-black text-[#2E7D32] text-xl">v1.1.0</span>
                <span className="text-sm font-bold text-gray-400">2026/03/09</span>
              </div>
              <ul className="text-sm font-bold text-gray-700 space-y-2 pl-2 list-disc list-inside">
                <li>데이테베이스 구조를 개편하였습니다.</li>
                <li>대국자 선택 기능을 개선하였습니다.</li>
                <li>대국 추가 시 반장전과 동풍전을 선택할 수 있도록 하였습니다.</li>
                <li>다가화 기능을 추가하였습니다.</li>
              </ul>
            </div>
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

      {/* --- 네비게이션 --- */}
      <nav className="fixed bottom-0 w-full bg-white border-t border-gray-200 flex justify-around p-2 pb-6 z-10">
        {[ { id:'기록', i:List }, { id:'통계', i:BarChart2 }, { id:'라이벌', i:Swords }, { id:'랭킹', i:Trophy }, { id:'업데이트', i:Bell } ].map(n => <button key={n.id} onClick={() => {setActiveNav(n.id); setSelectedGameId(null);}} className={`flex flex-col items-center p-2 transition-colors ${activeNav === n.id ? 'text-[#2E7D32]' : 'text-gray-400'}`}><n.i size={24}/><span className="text-[10px] mt-1 font-bold">{n.id}</span></button>)}
      </nav>

      {/* --- 모달 모음 --- */}

      {/* 1. Auth 모달 */}
      {isAuthModalOpen && (
        <div className="absolute inset-0 bg-black bg-opacity-60 z-[70] flex items-center justify-center animate-in fade-in">
          <div className="bg-white w-11/12 max-w-sm rounded-2xl p-6 relative shadow-2xl"><button onClick={() => setIsAuthModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20}/></button>
            <div className="flex mb-6 border-b border-gray-200"><button onClick={() => setAuthMode('login')} className={`flex-1 pb-2 font-bold ${authMode === 'login' ? 'text-[#2E7D32] border-b-2 border-[#2E7D32]' : 'text-gray-400'}`}>로그인</button><button onClick={() => setAuthMode('signup')} className={`flex-1 pb-2 font-bold ${authMode === 'signup' ? 'text-[#2E7D32] border-b-2 border-[#2E7D32]' : 'text-gray-400'}`}>회원가입</button></div>
            <div className="space-y-4">
              <input type="text" placeholder="이름 (예: 홍길동)" value={authName} onChange={e => setAuthName(e.target.value)} className="w-full p-3 border border-gray-300 rounded-xl font-bold outline-none focus:border-[#2E7D32]"/>
              <input type="password" maxLength={4} placeholder="비밀번호 (4자리)" value={authPin} onChange={e => setAuthPin(e.target.value)} className="w-full p-3 border border-gray-300 rounded-xl font-bold outline-none focus:border-[#2E7D32]"/>
              {authMode === 'signup' && <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl"><span className="block text-xs font-bold text-gray-500 mb-2">권한 요청</span><select value={authRoleReq} onChange={e => setAuthRoleReq(e.target.value)} className="w-full p-2 border border-gray-300 font-bold outline-none"><option value="player">일반 작사</option><option value="admin">관리자</option></select></div>}
              <button onClick={authMode === 'login' ? handleLogin : handleSignup} className="w-full bg-[#2E7D32] text-white font-bold py-3.5 rounded-xl hover:bg-green-800 active:scale-95 transition-all shadow-md">{authMode === 'login' ? '로그인' : '가입하기'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 2. 마스터(유저관리) 모달 */}
      {isMasterModalOpen && (
        <div className="absolute inset-0 bg-black bg-opacity-70 z-[80] flex flex-col justify-end animate-in fade-in">
          <div className="bg-gray-100 w-full h-[85%] rounded-t-3xl flex flex-col animate-in slide-in-from-bottom shadow-2xl"><div className="bg-yellow-600 rounded-t-3xl p-4 flex justify-between text-white items-center"><h2 className="text-lg font-bold flex gap-2"><Shield size={18}/> 마스터 보드</h2><button onClick={() => setIsMasterModalOpen(false)} className="hover:bg-yellow-700 p-1 rounded-full"><X size={20}/></button></div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {allUsers.filter(u => u.role !== 'master').map(u => (
                <div key={u.username} className="bg-white p-3 rounded-xl shadow-sm border border-gray-200">
                  <div className="flex justify-between items-center mb-2"><span className="font-bold text-lg">{u.username}</span><span className={`text-[10px] px-2 py-1 rounded font-bold ${u.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{u.role === 'admin' ? '🛡️ 관리자' : '♟️ 작사'}</span></div>
                  {!u.is_approved && <div className="bg-green-50 border border-green-200 p-2 rounded-lg mb-2 flex justify-between items-center"><span className="text-xs font-bold text-green-700">⚠️ 쓰기 권한 요청</span><button onClick={() => updateRole(u.username, {is_approved:true})} className="bg-[#2E7D32] text-white px-2 py-1 text-xs font-bold rounded flex gap-1 items-center hover:bg-green-800"><UserCheck size={14}/> 승인</button></div>}
                  <div className="flex gap-2 mt-2">
                    {u.role === 'admin' ? <button onClick={() => updateRole(u.username, {role:'player'})} className="flex-1 py-2 bg-orange-100 text-orange-700 font-bold text-xs rounded-lg hover:bg-orange-200">권한 강등</button> : <button onClick={() => updateRole(u.username, {role:'admin'})} className="flex-1 py-2 bg-blue-50 text-blue-600 font-bold text-xs rounded-lg hover:bg-blue-100">관리자 임명</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. 시즌 관리 모달 */}
      {isSeasonModalOpen && (
        <div className="absolute inset-0 bg-black bg-opacity-60 z-[70] flex items-center justify-center animate-in fade-in">
          <div className="bg-white w-11/12 rounded-2xl p-5 relative flex flex-col shadow-2xl"><button onClick={() => {setIsSeasonModalOpen(false); setEditingSeasonId(null);}} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20}/></button><h2 className="text-lg font-bold mb-4 flex gap-2 items-center text-gray-800"><CalendarPlus size={20}/> 시즌 관리</h2>
            <div className="flex-1 overflow-y-auto mb-4 space-y-2 border border-gray-200 p-2 bg-gray-50 max-h-[40vh] rounded-xl">{seasons.map(s => <div key={s.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex justify-between items-center"><div><div className="font-bold text-sm text-gray-800">{s.name}</div><div className="text-[10px] text-gray-500 mt-0.5">{s.start_date || '미정'} ~ {s.end_date || '미정'}</div></div><button onClick={() => {setEditingSeasonId(s.id); setNewSeasonName(s.name); setNewSeasonStart(s.start_date || ''); setNewSeasonEnd(s.end_date || '');}} className="text-gray-400 hover:text-[#2E7D32] p-1.5"><Edit size={16}/></button></div>)}</div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-3"><h3 className="text-xs font-bold text-gray-600">{editingSeasonId ? '시즌 수정' : '새 시즌 추가'}</h3><input type="text" placeholder="시즌 이름" value={newSeasonName} onChange={e => setNewSeasonName(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg text-sm font-bold outline-none focus:border-[#2E7D32]"/>
              <div className="flex gap-2"><div className="flex-1"><span className="block text-[10px] font-bold mb-1 ml-1 text-gray-500">시작일</span><input type="date" value={newSeasonStart} onChange={e => setNewSeasonStart(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg text-xs font-bold bg-white outline-none focus:border-[#2E7D32] text-gray-700"/></div><div className="flex-1"><span className="block text-[10px] font-bold mb-1 ml-1 text-gray-500">종료일</span><input type="date" value={newSeasonEnd} onChange={e => setNewSeasonEnd(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg text-xs font-bold bg-white outline-none focus:border-[#2E7D32] text-gray-700"/></div></div>
              <div className="flex gap-2 pt-1">{editingSeasonId && <button onClick={() => {setEditingSeasonId(null); setNewSeasonName('');}} className="flex-1 bg-gray-200 font-bold py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-300">취소</button>}<button onClick={handleSaveSeason} className={`flex-1 text-white font-bold py-2.5 rounded-lg text-sm shadow-md ${editingSeasonId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-[#2E7D32] hover:bg-green-800'}`}>{editingSeasonId ? '저장' : '추가'}</button></div>
            </div>
          </div>
        </div>
      )}

      {/* 4. 새 게임 모달 */}
      {isNewGameModalOpen && (
        <div className="absolute inset-0 bg-black bg-opacity-60 z-[50] flex flex-col justify-end animate-in fade-in">
          <div className="bg-[#F5F5DC] w-full h-[85%] rounded-t-3xl flex flex-col animate-in slide-in-from-bottom shadow-2xl"><div className="bg-[#2E7D32] rounded-t-3xl p-4 flex justify-between text-white items-center"><h2 className="text-lg font-bold">{newGameType} 대국 시작</h2><button onClick={() => setIsNewGameModalOpen(false)} className="hover:bg-green-700 p-1 rounded-full"><X size={20}/></button></div>
            <div className="p-5 flex-1 overflow-y-auto">
              <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-gray-100 shadow-sm mb-5"><div className="bg-gray-700 text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"><CalendarPlus size={14}/></div><input type="date" value={newGameDate} onChange={e => setNewGameDate(e.target.value)} className="flex-1 text-sm font-bold outline-none bg-transparent text-gray-800"/></div>
              
              {/* 💡 동풍전 / 반장전 선택 영역 추가 */}
              <div className="flex items-center gap-2 mb-3"><Users className="text-[#2E7D32]"/><p className="text-gray-800 font-bold text-sm">대국 설정 (동풍/반장)</p></div>
              <div className="flex gap-2 mb-5">
                {['반장전', '동풍전'].map(d => (
                  <button key={d} onClick={() => setNewGameDuration(d)} className={`flex-1 py-3 rounded-xl font-bold border-2 transition-colors ${newGameDuration === d ? 'border-[#2E7D32] bg-[#2E7D32] text-white' : 'bg-white text-gray-400 border-gray-100 hover:bg-gray-50'}`}>{d}</button>
                ))}
              </div>

              <div className="flex items-center gap-2 mb-4"><Users className="text-[#2E7D32]"/><p className="text-gray-800 font-bold text-sm">초기 좌석 배정</p></div>
              <div className="space-y-3 pb-20">
                {[{w:'동',s:playerE,st:setPlayerE},{w:'남',s:playerS,st:setPlayerS},{w:'서',s:playerW,st:setPlayerW},...(newGameType === '4인' ? [{w:'북',s:playerN,st:setPlayerN}] : [])].map(x => 
                  <div key={x.w} className="flex items-center gap-3 bg-white p-2 rounded-xl border border-gray-100 shadow-sm relative">
                    <div className="bg-[#2E7D32] text-white w-8 h-8 rounded-lg flex justify-center items-center font-bold text-sm shadow-inner">{x.w}</div>
                    <PlayerSearchInput wind={x.w} selectedId={x.s} onChange={x.st} players={players} onAddNewPlayer={handleAddNewPlayer} />
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 bg-white border-t border-gray-200">
              <button onClick={handleCreateNewGame} className="w-full bg-[#2E7D32] text-white font-bold text-sm py-4 rounded-xl shadow-md active:scale-95 transition-all">대국 시작하기</button>
            </div>
          </div>
        </div>
      )}

      {/* 5. 국 기록 입력 모달 */}
      {isRoundModalOpen && (
        <div className="absolute inset-0 bg-[#F5F5DC] z-[60] flex flex-col animate-in slide-in-from-bottom">
          <div className="bg-[#2E7D32] text-white p-4 flex justify-between items-center pt-10 shadow-sm z-10"><button onClick={() => setIsRoundModalOpen(false)}><ChevronLeft size={28}/></button><h2 className="text-xl font-bold">{editingRoundId ? '기록 수정' : `${wind}${roundNum}국 기록`}</h2>
            <button onClick={handleSaveRound} className="text-sm font-bold bg-green-700 px-3 py-1 rounded hover:bg-green-600">저장</button>
          </div>
          <div className="flex bg-white shadow-sm z-10 text-sm">{['화료','유국','촌보'].map(m => <button key={m} onClick={() => setRecordMode(m)} className={`flex-1 py-4 font-bold border-b-4 transition-colors ${recordMode === m ? (m === '촌보' ? 'border-red-500 text-red-600' : 'border-[#2E7D32] text-[#2E7D32]') : 'border-transparent text-gray-400'}`}>{m}</button>)}</div>
          <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-32">
            <section className="space-y-2"><h3 className="font-bold text-base border-b border-gray-200 pb-1 text-gray-800">국 / 본장</h3>
              <div className="flex bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm gap-4 items-center"><span className="font-bold text-green-700 text-sm w-8 text-center shrink-0">국풍</span><div className="flex-1 flex gap-1.5">{['동','남','서','북'].map(w => <button key={w} onClick={() => {setWind(w);setHonba(0);}} className={`flex-1 py-1.5 rounded-lg font-bold border transition-colors ${wind === w ? 'bg-[#2E7D32] border-[#2E7D32] text-white' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>{w}</button>)}</div></div>
              <div className="flex gap-2">
                <div className="flex-1 flex bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm gap-4 items-center"><span className="font-bold text-[#2E7D32] text-sm w-8 text-center shrink-0">국</span><div className="flex-1 flex gap-1.5">{(currentGame?.type === '3인' ? [1,2,3] : [1,2,3,4]).map(n => <button key={n} onClick={() => {setRoundNum(n);setHonba(0);}} className={`flex-1 py-1.5 rounded-lg font-bold border transition-colors ${roundNum === n ? 'bg-[#2E7D32] border-[#2E7D32] text-white' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>{n}</button>)}</div></div>
                <div className="flex-1 flex justify-between p-2.5 bg-white rounded-xl border border-gray-100 shadow-sm items-center"><span className="font-bold text-gray-700 text-sm ml-1">본장</span><div className="flex gap-1.5"><button onClick={() => setHonba(Math.max(0,honba-1))} className="bg-gray-100 w-8 h-8 rounded font-bold hover:bg-gray-200">-</button><span className="font-bold text-lg w-5 text-center text-gray-800">{honba}</span><button onClick={() => setHonba(honba+1)} className="bg-gray-100 w-8 h-8 rounded font-bold hover:bg-gray-200">+</button></div></div>
              </div>
            </section>
            
            {recordMode === '화료' ? (
              <>
                <section className="space-y-3"><h3 className="font-bold text-base border-b border-gray-200 pb-1 text-gray-800">화료 형태</h3>
                  <div className="flex gap-2">
                    <button onClick={() => handleWinMethodClick('쯔모')} className={`flex-1 py-3 rounded-xl font-bold border-2 transition-colors ${multipleType === '단독' && wins[0]?.winType === '쯔모' ? 'border-[#2E7D32] bg-[#2E7D32] text-white' : 'bg-white text-gray-400 border-gray-100'}`}>쯔모</button>
                    <button onClick={() => handleWinMethodClick('론')} className={`flex-1 py-3 rounded-xl font-bold border-2 transition-colors ${multipleType === '단독' && wins[0]?.winType === '론' ? 'border-[#2E7D32] bg-[#2E7D32] text-white' : 'bg-white text-gray-400 border-gray-100'}`}>론</button>
                    <button onClick={() => handleWinMethodClick('더블론')} className={`flex-1 py-3 rounded-xl font-bold border-2 transition-colors ${multipleType === '더블론' ? 'border-[#2E7D32] bg-[#2E7D32] text-white' : 'bg-white text-gray-400 border-gray-100'}`}>더블론</button>
                    {currentGame?.type === '4인' && (
                      <button onClick={() => handleWinMethodClick('트리플론')} className={`flex-1 py-3 rounded-xl font-bold border-2 transition-colors ${multipleType === '트리플론' ? 'border-[#2E7D32] bg-[#2E7D32] text-white' : 'bg-white text-gray-400 border-gray-100'}`}>트리플론</button>
                    )}
                  </div>
                </section>

                <section className="space-y-2"><div className="flex justify-between items-end"><h3 className="font-bold text-base text-gray-800">화료자 / 방총자</h3><p className="text-[10px] text-gray-400 font-medium">클릭: 화료 / 꾹 누르기: 방총</p></div>
                  <div className="grid grid-cols-2 gap-2">
                    {currentParticipants.map(r => {
                      const isWinner = wins.some(w => w.winnerId === r.player_id);
                      return (
                        <button key={r.player_id} onTouchStart={() => handlePlayerPressStart(r.player_id)} onTouchEnd={handlePlayerPressEnd} onMouseDown={() => handlePlayerPressStart(r.player_id)} onMouseUp={handlePlayerPressEnd} onMouseLeave={handlePlayerPressEnd} onClick={() => handlePlayerClick(r.player_id)} className={`relative h-14 rounded-xl font-bold text-sm border-2 select-none transition-colors ${isWinner ? 'bg-[#2E7D32] border-[#2E7D32] text-white shadow-inner' : loserId === r.player_id ? 'bg-orange-500 border-orange-500 text-white shadow-inner' : 'bg-white border-gray-200 text-gray-800'}`}>
                          {isWinner && <span className="absolute top-1 left-2 text-[9px] bg-white text-[#2E7D32] px-1 rounded shadow-sm">화료</span>}
                          {loserId === r.player_id && <span className="absolute top-1 left-2 text-[9px] bg-white text-orange-600 px-1 rounded shadow-sm">방총</span>}
                          {r.players?.original_name || r.players?.display_name}
                        </button>
                      )
                    })}
                  </div>
                </section>

                {wins.map((w, wIndex) => (
                  <div key={wIndex} className={`space-y-6 ${wIndex > 0 ? 'pt-6 border-t-4 border-gray-200 mt-6' : ''}`}>
                    {multipleType !== '단독' && (
                      <h3 className="font-black text-lg text-[#2E7D32] bg-green-50 p-2 rounded-lg text-center shadow-sm border border-green-100">
                        {w.winnerId ? currentParticipants.find(p=>p.player_id === w.winnerId)?.players?.original_name || currentParticipants.find(p=>p.player_id === w.winnerId)?.players?.display_name : `화료자 ${wIndex+1}`} 상세 기록
                      </h3>
                    )}

                    <section className="space-y-2"><h3 className="font-bold text-base border-b border-gray-200 pb-1 text-gray-800">멘젠 여부 및 대기</h3>
                      <div className="flex gap-2 mb-2"><button onClick={() => updateWin(wIndex, 'menzen', '멘젠')} className={`flex-1 py-3 rounded-xl font-bold border-2 transition-colors ${w.menzen === '멘젠' ? 'border-[#2E7D32] bg-[#2E7D32] text-white' : 'bg-white text-gray-400 border-gray-100'}`}>멘젠</button><button onClick={() => updateWin(wIndex, 'menzen', '비멘젠')} className={`flex-1 py-3 rounded-xl font-bold border-2 transition-colors ${w.menzen === '비멘젠' ? 'border-[#2E7D32] bg-[#2E7D32] text-white' : 'bg-white text-gray-400 border-gray-100'}`}>비멘젠</button></div>
                      <div className="grid grid-cols-3 gap-2">{['양면','샤보','간짱','변짱','단기','특수대기'].map(t => <button key={t} onClick={() => updateWin(wIndex, 'waitType', t)} className={`p-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${w.waitType === t ? 'border-[#2E7D32] bg-[#2E7D32] text-white' : 'bg-white border-gray-100 text-gray-600'}`}>{t}</button>)}</div>
                    </section>

                    <section className="space-y-4"><div className="flex justify-between items-end border-b border-gray-200 pb-1"><div className="flex items-center gap-2"><h3 className="font-bold text-base text-gray-800">역 선택</h3>{w.menzen === '비멘젠' && <span className="text-[10px] text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">후로 감소 자동 적용</span>}</div><span className="text-xs font-bold text-[#2E7D32]">선택됨: {w.yaku.length}개</span></div>{Object.entries(yakuData).map(([cat,yakus]) => <div key={cat}><h4 className="font-bold text-[#2E7D32] text-xs mb-1.5">{cat}</h4><div className="grid grid-cols-3 gap-1.5">{yakus.map(y => {if(currentGame?.type === '3인' && y === '삼색동순')return null; const isSel = w.yaku.includes(y); const isDis = w.menzen === '비멘젠' && menzenOnlyYaku.includes(y); const isDec = w.menzen === '비멘젠' && targetFuroYaku.includes(y); return <button key={y} onClick={() => !isDis && toggleWinYaku(wIndex, y)} disabled={isDis} className={`relative p-2 rounded-lg text-xs font-bold border transition-colors select-none ${isDis ? 'bg-gray-100 border-gray-200 text-gray-400 opacity-50 cursor-not-allowed' : isSel ? 'bg-green-50 border-[#2E7D32] text-[#2E7D32] shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{isSel && isDec && <span className="absolute -top-2 left-1 text-[8px] bg-orange-100 border border-orange-400 text-orange-600 px-1 rounded shadow-sm">(후로 감소 -1)</span>}{y}</button>})}</div></div>)}</section>

                    <section className="space-y-3"><h3 className="font-bold text-base border-b border-gray-200 pb-1 text-gray-800">도라 / 판수 / 부수</h3><div className="grid grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-sm"><div className="flex justify-between items-center"><span className="font-bold text-amber-600 text-sm">도라</span><div className="flex items-center gap-2"><button onClick={() => updateWin(wIndex, 'dora', Math.max(0,w.dora-1))} className="w-6 h-6 bg-gray-100 rounded font-bold hover:bg-gray-200">-</button><span className="w-4 text-center font-bold text-gray-800">{w.dora}</span><button onClick={() => updateWin(wIndex, 'dora', w.dora+1)} className="w-6 h-6 bg-gray-100 rounded font-bold hover:bg-gray-200">+</button></div></div><div className="flex justify-between items-center"><span className="font-bold text-amber-600 text-sm">적도라</span><div className="flex items-center gap-2"><button onClick={() => updateWin(wIndex, 'aka', Math.max(0,w.aka-1))} className="w-6 h-6 bg-gray-100 rounded font-bold hover:bg-gray-200">-</button><span className="w-4 text-center font-bold text-gray-800">{w.aka}</span><button onClick={() => updateWin(wIndex, 'aka', w.aka+1)} className="w-6 h-6 bg-gray-100 rounded font-bold hover:bg-gray-200">+</button></div></div><div className="flex justify-between items-center"><span className="font-bold text-amber-600 text-sm">뒷도라</span><div className="flex items-center gap-2"><button onClick={() => updateWin(wIndex, 'ura', Math.max(0,w.ura-1))} className="w-6 h-6 bg-gray-100 rounded font-bold hover:bg-gray-200">-</button><span className="w-4 text-center font-bold text-gray-800">{w.ura}</span><button onClick={() => updateWin(wIndex, 'ura', w.ura+1)} className="w-6 h-6 bg-gray-100 rounded font-bold hover:bg-gray-200">+</button></div></div>{currentGame?.type === '3인' && <div className="flex justify-between items-center"><span className="font-bold text-amber-600 text-sm">북도라</span><div className="flex items-center gap-2"><button onClick={() => updateWin(wIndex, 'pei', Math.max(0,w.pei-1))} className="w-6 h-6 bg-gray-50 rounded font-bold hover:bg-gray-100 text-gray-700">-</button><span className="w-4 text-center font-bold text-gray-800">{w.pei}</span><button onClick={() => updateWin(wIndex, 'pei', w.pei+1)} className="w-6 h-6 bg-gray-50 rounded font-bold hover:bg-gray-100 text-gray-700">+</button></div></div>}</div>
                      <div className="flex justify-between p-3 bg-green-50 rounded-xl border border-green-200 items-center relative shadow-sm"><span className="absolute -top-2 left-2 bg-green-200 text-green-800 text-[9px] px-1 rounded font-bold shadow-sm">자동계산 (수동조작 가능)</span><span className="font-bold text-[#2E7D32] text-sm">판수</span><div className="flex gap-2"><button onClick={() => updateWin(wIndex, 'han', Math.max(1,w.han-1))} className="bg-white w-8 h-8 rounded font-bold shadow-sm hover:bg-gray-50">-</button><span className="font-black text-xl w-6 text-center text-[#2E7D32]">{w.han}</span><button onClick={() => updateWin(wIndex, 'han', w.han+1)} className="bg-white w-8 h-8 rounded font-bold shadow-sm hover:bg-gray-50">+</button></div></div>
                      {w.han < 5 && <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-2"><div className="flex justify-between items-center"><span className="font-bold text-[#2E7D32] text-sm">부수 선택</span><span className="font-black text-lg text-[#2E7D32]">{w.fu}부</span></div><div className="grid grid-cols-6 gap-1">{[20,25,30,40,50,60,70,80,90,100,110].map(f => <button key={f} onClick={() => updateWin(wIndex, 'fu', f)} className={`py-1.5 rounded text-xs font-bold border transition-colors ${w.fu === f ? 'bg-[#2E7D32] text-white border-[#2E7D32]' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}>{f}</button>)}</div></div>}
                    </section>
                  </div>
                ))}
              </>
            ) : recordMode === '유국' ? (
              <><section className="space-y-3"><div className="flex justify-between items-end border-b border-gray-200 pb-1"><h3 className="font-bold text-base text-gray-800">텐파이 플레이어</h3><p className="text-[10px] text-gray-400">선택 안하면 전원 노텐</p></div><div className="grid grid-cols-2 gap-2">{currentParticipants.map(r => <button key={`tenpai-${r.player_id}`} onClick={() => toggleTenpai(r.player_id)} disabled={abortiveType !== null} className={`h-12 rounded-xl font-bold text-sm border-2 transition-colors select-none ${tenpaiPlayers.includes(r.player_id) ? 'bg-[#2E7D32] border-[#2E7D32] text-white shadow-inner' : 'bg-white border-gray-200 text-gray-800 disabled:opacity-50'}`}>{r.players?.original_name || r.players?.display_name}</button>)}</div></section>
                <section className="space-y-3"><div className="flex justify-between items-end border-b border-gray-200 pb-1"><h3 className="font-bold text-base text-gray-800">유국만관</h3></div><div className="grid grid-cols-2 gap-2">{currentParticipants.map(r => <button key={`nagashi-${r.player_id}`} onClick={() => toggleNagashi(r.player_id)} disabled={abortiveType !== null} className={`h-12 rounded-xl font-bold text-sm border-2 transition-colors select-none ${nagashiMangan.includes(r.player_id) ? 'bg-red-500 border-red-500 text-white shadow-inner' : 'bg-white border-gray-200 text-gray-600 disabled:opacity-50'}`}>{r.players?.original_name || r.players?.display_name}</button>)}</div></section>
                <section className="space-y-3"><h3 className="font-bold text-base text-gray-800 border-b border-gray-200 pb-1">도중유국 (선택)</h3><div className="grid grid-cols-2 gap-2">{abortiveDraws.map(t => <button key={t} onClick={() => setAbortiveType(prev => prev === t ? null : t)} className={`h-12 rounded-xl text-center font-bold text-sm border-2 transition-colors ${abortiveType === t ? 'bg-gray-700 border-gray-700 text-white shadow-inner' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-50'}`}>{t}</button>)}</div></section></>
            ) : (
              <section className="space-y-3"><h3 className="font-bold text-base text-red-600 border-b border-gray-200 pb-1">촌보 발생자 선택</h3><div className="grid grid-cols-2 gap-2">{currentParticipants.map(r => <button key={`chombo-${r.player_id}`} onClick={() => setChomboPlayerId(r.player_id)} className={`h-14 rounded-xl font-bold text-sm border-2 transition-colors ${chomboPlayerId === r.player_id ? 'bg-red-500 border-red-500 text-white shadow-inner' : 'bg-white border-gray-200 text-gray-800'}`}>{r.players?.original_name || r.players?.display_name}</button>)}</div></section>
            )}
            <section className="pt-4 border-t border-gray-200"><textarea placeholder="해당 국에 대한 메모나 코멘트를 자유롭게 적어주세요. (선택)" value={roundComment} onChange={e => setRoundComment(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-[#2E7D32] h-20 resize-none shadow-sm"/></section>
          </div>
          
          <div className="p-4 bg-white border-t border-gray-200 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] z-10">
            <button onClick={handleSaveRound} className={`w-full text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all ${recordMode === '화료' ? 'bg-[#2E7D32] hover:bg-green-800' : recordMode === '유국' ? 'bg-gray-600 hover:bg-gray-700' : 'bg-red-600 hover:bg-red-700'}`}>
              <Check size={20} strokeWidth={3} /> {recordMode === '화료' ? '화료 기록 저장' : recordMode === '유국' ? '유국 기록 저장' : '촌보 기록 저장'}
            </button>
          </div>
        </div>
      )}

      {/* 6. 대국 종료 모달 */}
      {isEndGameModalOpen && (
        <div className="absolute inset-0 bg-black bg-opacity-60 z-[60] flex flex-col justify-end animate-in fade-in">
          <div className="bg-[#F5F5DC] w-full h-[70%] rounded-t-3xl pb-6 shadow-2xl flex flex-col animate-in slide-in-from-bottom"><div className="bg-[#1e293b] rounded-t-3xl p-4 flex justify-between items-center text-white"><h2 className="text-lg font-bold flex items-center gap-2"><Flag size={18}/> 대국 결과 입력</h2><button onClick={() => setIsEndGameModalOpen(false)} className="hover:bg-gray-700 p-1 rounded-full"><X size={20}/></button></div>
            <div className="p-4 space-y-4 mt-2 flex-1 overflow-y-auto">
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-lg text-xs font-bold shadow-sm">⚠️ 소점 총합은 {currentGame?.type === '4인' ? '100,000' : '105,000'}점이어야 합니다.<br/>현재 입력 합계: <span className="text-red-500">{finalScores.reduce((sum,f) => sum + (parseInt(f.score) || 0), 0).toLocaleString()}점</span></div>
              <div className="space-y-2">{finalScores.map((p,i) => <div key={p.player_id} className="flex gap-3 items-center bg-white p-3 rounded-xl border border-gray-200 shadow-sm"><span className="w-16 font-bold truncate text-gray-800 text-sm">{p.name}</span>
                <input type="text" placeholder="소점 (예: -500)" value={p.score} onChange={e => updateFinalScore(i, e.target.value)} className="flex-1 p-2 bg-gray-50 border border-gray-200 rounded-lg text-right font-bold text-sm outline-none focus:border-[#2E7D32]"/>
              </div>)}</div>
              <p className="text-center text-gray-400 text-[10px] font-bold mt-2">※ PT(우마/오카)는 자동 계산됩니다.</p>
            </div>
            <div className="p-4 bg-transparent mt-2"><button onClick={handleConfirmEndGame} className="w-full bg-[#1e293b] text-white font-bold text-sm py-4 rounded-xl hover:bg-gray-800 shadow-md active:scale-95 transition-all">결과 저장 및 대국 종료</button></div>
          </div>
        </div>
      )}

      {/* 개인 통계 상세 모달 (Player Detail) */}
      {selectedStatPlayer && (() => {
        const modalGames = games.filter(g => {
          if (g.status !== '종료') return false;
          if (playerStatTab !== '전체' && g.type !== playerStatTab) return false;
          if (selectedSeason !== 'all' && g.season_id !== selectedSeason) return false;
          const pNames = g.game_results?.map(r => r.players?.original_name || r.players?.display_name) || [];
          return pNames.includes(selectedStatPlayer.name);
        });

        let playCount = 0, tScore = 0, tUma = 0, rCount = 0; let tUma4 = 0, tUma3 = 0; let ranks = [0, 0, 0, 0];
        let wCount = 0, wScore = 0, wScoreCount = 0, dCount = 0, dScore = 0, dScoreCount = 0, mHonba = 0;
        let maxScore = -99999, minScore = 99999, maxWinScore = 0, maxDealInScore = 0;
        let tobiCount = 0, yakumanCount = 0, chomboCount = 0;
        let yakus = {}, waitTypes = {}; let menzenTsumo = 0, menzenRon = 0, furoTsumo = 0, furoRon = 0;
        let riichiWinCount = 0, damaWinCount = 0, furoWinCount = 0;

        modalGames.forEach(g => {
          const pRes = g.game_results?.find(r => (r.players?.original_name || r.players?.display_name) === selectedStatPlayer.name);
          if(!pRes) return;
          const myPlayerId = pRes.player_id; 
          
          const sortedResults = [...(g.game_results || [])].sort((a, b) => b.score - a.score);
          const myRankIndex = sortedResults.findIndex(r => r.player_id === myPlayerId);
          const finalScore = Number(pRes.score); const finalPt = Number(pRes.pt);

          tScore += finalScore; tUma += finalPt;
          if (g.type === '4인') tUma4 += finalPt; if (g.type === '3인') tUma3 += finalPt;
          ranks[myRankIndex] += 1; playCount++;
          if (finalScore > maxScore) maxScore = finalScore; if (finalScore < minScore) minScore = finalScore;
          if (finalScore < 0) tobiCount++;

          g.rounds?.forEach(r => {
            rCount++; 
            if (r.type === '촌보' && r.loser_id === myPlayerId) chomboCount++;
            if (r.type === '화료' && r.round_wins?.length > 0) {
              
              let sortedWins = [...r.round_wins];
              if (r.multiple_type !== '단독' && r.loser_id) {
                const winds = g.type === '4인' ? ['동','남','서','북'] : ['동','남','서'];
                const loserWind = g.game_results.find(p => p.player_id === r.loser_id)?.wind;
                const loserIdx = winds.indexOf(loserWind);
                sortedWins.sort((a, b) => {
                  const windA = g.game_results.find(p => p.player_id === a.winner_id)?.wind;
                  const windB = g.game_results.find(p => p.player_id === b.winner_id)?.wind;
                  const distA = (winds.indexOf(windA) - loserIdx + 4) % 4;
                  const distB = (winds.indexOf(windB) - loserIdx + 4) % 4;
                  return distA - distB;
                });
              }

              sortedWins.forEach((winData, winIndex) => {
                if (winData.winner_id === myPlayerId) {
                  wCount++;
                  const winds = g.type === '4인' ? ['동','남','서','북'] : ['동','남','서'];
                  const dealerWind = winds[(r.round_num - 1) % winds.length];
                  const isDealer = g.game_results.find(res => res.wind === dealerWind)?.player_id === myPlayerId;
                  
                  const appliedHonba = winIndex === 0 ? r.honba : 0;
                  const { pureTotal } = getMahjongScore(winData.han, winData.fu, isDealer, r.win_type === '쯔모', appliedHonba, g.type === '3인', winData.yaku_list);

                  if (pureTotal > 0) { wScore += pureTotal; wScoreCount++; if (pureTotal > maxWinScore) maxWinScore = pureTotal; }
                  if (r.honba > mHonba) mHonba = r.honba;
                  if (winData.han >= 13 || winData.yaku_list?.some(y => yakuData['역만']?.includes(y) || yakuData['더블역만']?.includes(y))) yakumanCount++;

                  winData.yaku_list?.forEach(y => { yakus[y] = (yakus[y] || 0) + 1; if (y === '리치' || y === '더블리치') riichiWinCount++; });
                  if (winData.wait_type) waitTypes[winData.wait_type] = (waitTypes[winData.wait_type] || 0) + 1;

                  const isMenzen = winData.menzen === '멘젠';
                  if (isMenzen && r.win_type === '쯔모') menzenTsumo++; if (isMenzen && r.win_type === '론') menzenRon++;
                  if (!isMenzen && r.win_type === '쯔모') furoTsumo++; if (!isMenzen && r.win_type === '론') furoRon++;
                  if (!isMenzen) furoWinCount++;
                  if (isMenzen && winData.yaku_list && !winData.yaku_list.includes('리치') && !winData.yaku_list.includes('더블리치')) damaWinCount++;
                }
              });

              if (r.win_type === '론' && r.loser_id === myPlayerId) {
                dCount++;
                let totalLoss = 0;
                sortedWins.forEach((w, wIndex) => {
                  const winds = g.type === '4인' ? ['동','남','서','북'] : ['동','남','서'];
                  const dealerWind = winds[(r.round_num - 1) % winds.length];
                  const isDealer = g.game_results.find(res => res.wind === dealerWind)?.player_id === w.winner_id;
                  const appliedHonba = wIndex === 0 ? r.honba : 0;
                  totalLoss += getMahjongScore(w.han, w.fu, isDealer, false, appliedHonba, g.type === '3인', w.yaku_list).pureTotal;
                });
                if (totalLoss > 0) { dScore += totalLoss; dScoreCount++; if (totalLoss > maxDealInScore) maxDealInScore = totalLoss; }
              }
            }
          });
        });

        const mStat = {
          gamesPlayed: playCount, totalUma: tUma, totalUma4: tUma4, totalUma3: tUma3, winCount: wCount, dealInCount: dCount, 
          yakumanCount, chomboCount, ranks, tobiCount, rentaiCount: ranks[0] + ranks[1],
          tobiRate: playCount > 0 ? ((tobiCount / playCount) * 100).toFixed(1) : 0,
          rentaiRate: playCount > 0 ? (((ranks[0] + ranks[1]) / playCount) * 100).toFixed(1) : 0,
          winRate: rCount > 0 ? ((wCount / rCount) * 100).toFixed(1) : 0, dealInRate: rCount > 0 ? ((dCount / rCount) * 100).toFixed(1) : 0, 
          maxScore, minScore, maxWinScore, maxDealInScore, avgScore: playCount > 0 ? Math.floor(tScore / playCount) : 0,
          avgWinScore: wScoreCount > 0 ? Math.floor(wScore / wScoreCount) : 0, avgUma: playCount > 0 ? (tUma / playCount).toFixed(1) : 0,
          maxHonba: mHonba, avgDealInScore: dScoreCount > 0 ? Math.floor(dScore / dScoreCount) : 0,
          yakus, riichiWinCount, damaWinCount, furoWinCount, menzenTsumo, menzenRon, furoTsumo, furoRon, waitTypes
        };

        const rtAllGames = games.filter(g => {
          if (g.status !== '종료') return false;
          const pNames = g.game_results?.map(r => r.players?.original_name || r.players?.display_name) || [];
          return pNames.includes(selectedStatPlayer.name);
        });
        
        let rtTotalRounds = 0, rtTotalWins = 0, rtTotalDealIns = 0, rtTotalWinScore = 0, rtFuroWins = 0, rtRyanmenWins = 0, rtLuckPoints = 0, rtGames4 = 0, rtRentai4 = 0;

        rtAllGames.forEach(g => {
          const myRes = g.game_results?.find(r => (r.players?.original_name || r.players?.display_name) === selectedStatPlayer.name);
          if (!myRes) return; const myPlayerId = myRes.player_id;
          
          if (g.type === '4인') {
            rtGames4++;
            const sorted = [...(g.game_results || [])].sort((a,b) => b.score - a.score);
            const myRank = sorted.findIndex(s => s.player_id === myPlayerId) + 1;
            if (myRank <= 2) rtRentai4++;
          }

          g.rounds?.forEach(r => {
            rtTotalRounds++; 
            if (r.type === '화료' && r.round_wins?.length > 0) {
              r.round_wins.forEach(winData => {
                if (winData.winner_id === myPlayerId) {
                  rtTotalWins++;
                  const winds = g.type === '4인' ? ['동','남','서','북'] : ['동','남','서'];
                  const dealerWind = winds[(r.round_num - 1) % winds.length];
                  const isDealer = g.game_results.find(res => res.wind === dealerWind)?.player_id === myPlayerId;
                  const { pureTotal } = getMahjongScore(winData.han, winData.fu, isDealer, r.win_type === '쯔모', 0, g.type === '3인', winData.yaku_list);
                  rtTotalWinScore += pureTotal;

                  if (winData.menzen === '비멘젠') rtFuroWins++; if (winData.wait_type === '양면') rtRyanmenWins++;
                  if (winData.yaku_list?.includes('리치') || winData.yaku_list?.includes('더블리치')) { if (winData.yaku_list?.includes('일발')) rtLuckPoints++; }
                  if (winData.yaku_list?.includes('해저로월')) rtLuckPoints++; if (winData.yaku_list?.includes('영상개화')) rtLuckPoints++; if (winData.ura > 0) rtLuckPoints++; 
                }
              });
            }
            if (r.type === '화료' && r.win_type === '론' && r.loser_id === myPlayerId) rtTotalDealIns++;
          });
        });

        const rtNorm = (v, min, max) => Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));

        const scoreFire = rtTotalWins > 0 ? rtNorm(rtTotalWinScore / rtTotalWins, 3000, 10000) : 0;
        const scoreDef = rtTotalRounds > 0 ? rtNorm(25 - (rtTotalDealIns / rtTotalRounds * 100), 25 - 25, 25 - 10) : 0;
        const scoreStab = rtGames4 > 0 ? rtNorm(rtRentai4 / rtGames4 * 100, 30, 60) : 0;
        const scoreFlex = rtTotalWins > 0 ? rtNorm(rtFuroWins / rtTotalWins * 100, 10, 50) : 0;
        const scoreLuck = rtTotalWins > 0 ? rtNorm(rtLuckPoints / rtTotalWins, 0.1, 0.5) : 0;
        const scoreEffi = rtTotalWins > 0 ? rtNorm(rtRyanmenWins / rtTotalWins * 100, 25, 65) : 0;

        const rtRadarData = [
          { label: '화력', score: scoreFire, desc: '평균 타점 기반\n(평균-3000)/7000\n3,000~10,000' }, { label: '수비', score: scoreDef, desc: '방총률 역산\n(25-방총률)/15\n25%~10%' },
          { label: '안정', score: scoreStab, desc: '4인 연대율 기반\n(연대율-30)/30\n30%~60%' }, { label: '유연성', score: scoreFlex, desc: '비멘젠 화료 비중\n(후로화료율-10)/40\n10%~50%' },
          { label: '행운', score: scoreLuck, desc: '일발/해저/영상/뒷도라 빈도\n(행운지수-0.1)/0.4\n0.1개~0.5개' }, { label: '조패', score: scoreEffi, desc: '양면 대기 화료 비중\n(양면화료율-25)/40\n25%~65%' },
        ];

        const rtCenterX = 100, rtCenterY = 100, rtRadius = 70;
        const rtGetPt = (s, i) => { const angle = (Math.PI * 2) / 6 * i - (Math.PI / 2); const r = (s / 100) * rtRadius; return `${rtCenterX + r * Math.cos(angle)},${rtCenterY + r * Math.sin(angle)}`; };
        const rtPolyPts = rtRadarData.map((d, i) => rtGetPt(d.score, i)).join(' ');

        const handleWinBreakdown = () => {
          const stats = { '쯔모': 0 };
          modalGames.forEach(g => g.rounds?.forEach(r => {
            if (r.type === '화료' && r.round_wins?.length > 0) {
              r.round_wins.forEach(w => {
                const winnerName = g.game_results.find(res => res.player_id === w.winner_id)?.players?.original_name;
                if (winnerName === selectedStatPlayer.name) {
                  if (r.win_type === '쯔모') stats['쯔모']++;
                  else if (r.loser_id) { const loserName = g.game_results.find(res => res.player_id === r.loser_id)?.players?.original_name; if (loserName) stats[loserName] = (stats[loserName] || 0) + 1; }
                }
              });
            }
          }));
          const rawData = Object.entries(stats).map(([name, count]) => ({ name, count })).filter(d => d.count > 0).sort((a,b) => b.count !== a.count ? b.count - a.count : a.name.localeCompare(b.name));
          let currentRank = 1; const rankedData = rawData.map((item, index, arr) => { if (index > 0 && item.count < arr[index - 1].count) currentRank = index + 1; return { ...item, rank: currentRank }; });
          setBreakdownData({ title: `${selectedStatPlayer.name}의 화료 대상`, data: rankedData });
        };

        const handleDealInBreakdown = () => {
          const stats = {};
          modalGames.forEach(g => g.rounds?.forEach(r => {
            if (r.type === '화료' && r.win_type === '론' && r.round_wins?.length > 0) {
              const loserName = g.game_results.find(res => res.player_id === r.loser_id)?.players?.original_name;
              if (loserName === selectedStatPlayer.name) {
                r.round_wins.forEach(w => {
                  const winnerName = g.game_results.find(res => res.player_id === w.winner_id)?.players?.original_name;
                  if (winnerName) stats[winnerName] = (stats[winnerName] || 0) + 1;
                });
              }
            }
          }));
          const rawData = Object.entries(stats).map(([name, count]) => ({ name, count })).filter(d => d.count > 0).sort((a,b) => b.count !== a.count ? b.count - a.count : a.name.localeCompare(b.name));
          let currentRank = 1; const rankedData = rawData.map((item, index, arr) => { if (index > 0 && item.count < arr[index - 1].count) currentRank = index + 1; return { ...item, rank: currentRank }; });
          setBreakdownData({ title: `${selectedStatPlayer.name}의 방총 대상`, data: rankedData });
        };

        const chronologicalGames = [...modalGames].reverse();
        let currentTotalUma = 0;
        const cumulativeGames = chronologicalGames.map(g => {
          const pRes = g.game_results?.find(r => (r.players?.original_name || r.players?.display_name) === selectedStatPlayer.name);
          const pt = Number(pRes?.pt || 0); currentTotalUma += pt;
          return { id: g.id, pt: parseFloat(currentTotalUma.toFixed(1)), gamePt: pt };
        });

        const recentGames = cumulativeGames.slice(-8);
        const chartWidth = 320, chartHeight = 150, padX = 25, padY = 35;
        const innerW = chartWidth - padX * 2, innerH = chartHeight - padY * 2;
        const pts = recentGames.map(g => g.pt);
        let maxPt = pts.length > 0 ? Math.max(...pts) : 0; let minPt = pts.length > 0 ? Math.min(...pts) : 0;
        if (maxPt === minPt) { maxPt += 10; minPt -= 10; } else { const diff = maxPt - minPt; maxPt += diff * 0.2; minPt -= diff * 0.2; }
        const ptRange = maxPt - minPt;
        const getX = (index) => recentGames.length === 1 ? chartWidth / 2 : padX + (index * (innerW / (recentGames.length - 1)));
        const getY = (pt) => padY + innerH - ((pt - minPt) / ptRange) * innerH;
        const zeroY = getY(0);
        const pointsStr = recentGames.map((g, i) => `${getX(i)},${getY(g.pt)}`).join(' ');

        return (
          <div className="absolute inset-0 bg-black bg-opacity-70 z-[90] flex flex-col justify-end animate-in fade-in">
            <div className="bg-[#F5F5DC] w-full h-[92%] rounded-t-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom">
              <div className="bg-[#1e293b] rounded-t-3xl p-4 flex justify-between items-center text-white shrink-0">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2"><PieChart size={20}/> {selectedStatPlayer.name}</h2>
                  <select value={selectedSeason} onChange={(e) => setSelectedSeason(e.target.value)} className="bg-gray-700 text-white text-[10px] font-bold py-1 px-2 mt-1 rounded appearance-none focus:outline-none">
                    <option value="all">전체 시즌</option>{seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <button onClick={() => setSelectedStatPlayerName(null)} className="p-1.5 hover:bg-gray-700 rounded-full transition-colors bg-gray-800"><X size={20}/></button>
              </div>
              
              <div className="flex bg-white border-b border-gray-200 shadow-sm shrink-0">
                {['전체', '4인', '3인'].map(tab => (
                  <button key={tab} onClick={() => setPlayerStatTab(tab)} className={`flex-1 py-3 text-sm font-bold transition-colors ${playerStatTab === tab ? 'text-[#2E7D32] border-b-2 border-[#2E7D32]' : 'text-gray-400 hover:text-gray-600'}`}>{tab}</button>
                ))}
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-10">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 text-center"><span className="block text-[10px] text-gray-500 font-bold mb-1">대국 수</span><span className="text-xl font-black text-gray-800">{mStat.gamesPlayed}국</span></div>
                  {playerStatTab === '전체' ? (
                     <div className="grid grid-cols-2 gap-2">
                       <div className="bg-green-50 p-2 rounded-xl border border-green-100 text-center flex flex-col justify-center"><span className="block text-[9px] text-gray-500 font-bold mb-0.5">4인 우마</span><span className={`text-lg font-black ${mStat.totalUma4 > 0 ? 'text-[#2E7D32]' : mStat.totalUma4 < 0 ? 'text-red-500' : 'text-gray-800'}`}>{mStat.totalUma4 > 0 ? '+' : ''}{mStat.totalUma4.toFixed(1)}</span></div>
                       <div className="bg-blue-50 p-2 rounded-xl border border-blue-100 text-center flex flex-col justify-center"><span className="block text-[9px] text-gray-500 font-bold mb-0.5">3인 우마</span><span className={`text-lg font-black ${mStat.totalUma3 > 0 ? 'text-blue-600' : mStat.totalUma3 < 0 ? 'text-red-500' : 'text-gray-800'}`}>{mStat.totalUma3 > 0 ? '+' : ''}{mStat.totalUma3.toFixed(1)}</span></div>
                     </div>
                  ) : (
                    <div className="bg-green-50 p-3 rounded-xl shadow-sm border border-green-200 text-center"><span className="block text-[10px] text-green-700 font-bold mb-1">현재 우마</span><span className={`text-xl font-black ${mStat.totalUma > 0 ? 'text-[#2E7D32]' : mStat.totalUma < 0 ? 'text-red-500' : 'text-gray-800'}`}>{mStat.totalUma > 0 ? '+' : ''}{mStat.totalUma.toFixed(1)}</span></div>
                  )}
                </div>

                {playerStatTab !== '전체' && (
                  <>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                      <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5"><BarChart size={16}/> 상세 통계</h3>
                      <div className="grid grid-cols-4 gap-2 text-center font-medium mb-3">
                        <div onClick={handleWinBreakdown} className="flex flex-col justify-center cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors active:scale-95 border border-transparent hover:border-gray-200"><span className="text-[10px] text-gray-500 font-bold underline decoration-dotted underline-offset-2 mb-0.5">화료 (상세)</span><span className="font-black text-[#2E7D32] text-sm">{mStat.winCount}회 <span className="block text-[10px] font-bold text-gray-400 leading-tight">({mStat.winRate}%)</span></span></div>
                        <div onClick={handleDealInBreakdown} className="flex flex-col justify-center cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors active:scale-95 border border-transparent hover:border-gray-200"><span className="text-[10px] text-gray-500 font-bold underline decoration-dotted underline-offset-2 mb-0.5">방총 (상세)</span><span className="font-black text-orange-500 text-sm">{mStat.dealInCount}회 <span className="block text-[10px] font-bold text-gray-400 leading-tight">({mStat.dealInRate}%)</span></span></div>
                        <div className="flex flex-col justify-center p-1"><span className="text-[10px] text-gray-500 font-bold mb-0.5">역만수</span><span className="font-black text-red-600 text-sm">{mStat.yakumanCount}회</span></div>
                        <div className="flex flex-col justify-center p-1"><span className="text-[10px] text-gray-500 font-bold mb-0.5">쵼보수</span><span className="font-black text-purple-600 text-sm">{mStat.chomboCount}회</span></div>
                      </div>
                      <div className={`grid ${playerStatTab === '3인' ? 'grid-cols-3' : 'grid-cols-4'} gap-2 text-center font-medium mb-3 bg-gray-50 p-2 rounded-lg`}>
                        {[1, 2, 3, 4].map(rank => {
                          if (playerStatTab === '3인' && rank === 4) return null;
                          const count = mStat.ranks[rank-1]; const pct = mStat.gamesPlayed > 0 ? ((count / mStat.gamesPlayed) * 100).toFixed(0) : 0;
                          return (<div key={rank} className="flex flex-col justify-center"><span className="text-[10px] font-bold text-gray-600 mb-0.5">{rank}등수</span><span className="font-black text-gray-800 text-sm">{count}회 <span className="block text-[9px] text-gray-400 leading-tight">({pct}%)</span></span></div>)
                        })}
                      </div>
                      <div className={`grid ${playerStatTab === '3인' ? 'grid-cols-1' : 'grid-cols-2'} gap-2 text-center font-medium`}>
                        {playerStatTab !== '3인' && (
                          <div className="flex flex-col justify-center border border-blue-100 bg-blue-50 py-2 rounded-lg"><span className="text-[10px] text-blue-700 font-bold mb-0.5">연대율 (1~2등)</span><span className="font-black text-blue-600 text-sm">{mStat.rentaiCount}회 <span className="block text-[10px] font-medium text-blue-400 leading-tight">({mStat.rentaiRate}%)</span></span></div>
                        )}
                        <div className="flex flex-col justify-center border border-slate-200 bg-slate-50 py-2 rounded-lg"><span className="text-[10px] text-slate-600 font-bold mb-0.5">들통율 (토비)</span><span className="font-black text-slate-700 text-sm">{mStat.tobiCount}회 <span className="block text-[10px] font-medium text-slate-400 leading-tight">({mStat.tobiRate}%)</span></span></div>
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

                    {/* 📈 꺾은선 차트 */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 relative overflow-hidden mt-4">
                      <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-1.5"><BarChart2 size={16}/> 최근 8국 누적 우마 변동</h3>
                      {recentGames.length === 0 ? <p className="text-center text-gray-400 py-6 font-bold text-xs">종료된 대국이 없습니다.</p> : (
                        <div className="w-full overflow-visible mt-4">
                          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto overflow-visible">
                            <line x1={padX} y1={zeroY} x2={chartWidth - padX} y2={zeroY} stroke="#e2e8f0" strokeWidth="2" strokeDasharray="4 4" />
                            <polyline points={pointsStr} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                            {recentGames.map((g, i) => {
                              const x = getX(i), y = getY(g.pt);
                              const dotColor = g.gamePt > 0 ? '#2E7D32' : g.gamePt === 0 ? '#64748b' : '#ef4444';
                              return (
                                <g key={`${g.id}-${i}`}>
                                  <line x1={x} y1={chartHeight - 10} x2={x} y2={y} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="2 2" />
                                  <circle cx={x} cy={y} r="4.5" fill="white" stroke={dotColor} strokeWidth="2.5" />
                                  <text x={x} y={y - 12} textAnchor="middle" fontSize="11" fontWeight="900" fill={g.pt > 0 ? '#2E7D32' : g.pt < 0 ? '#ef4444' : '#64748b'}>{g.pt > 0 ? `+${g.pt}` : g.pt}</text>
                                  <text x={x} y={y + 16} textAnchor="middle" fontSize="9" fontWeight="bold" fill={dotColor} opacity="0.8">({g.gamePt > 0 ? `+${g.gamePt}` : g.gamePt})</text>
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

                {/* ⚔️ 육각형 레이더 차트 (All-Time) */}
                {playerStatTab === '전체' && (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col items-center">
                    <h3 className="text-sm font-bold text-gray-800 mb-6 w-full flex items-center gap-1.5"><BarChart2 size={16} className="text-[#2E7D32]"/> 작사 성향 분석 (All-Time)</h3>
                    
                    <div className="relative">
                      <svg width="220" height="220" viewBox="0 0 200 200">
                        {[20, 40, 60, 80, 100].map(t => <polygon key={t} points={rtRadarData.map((_, i) => rtGetPt(t, i)).join(' ')} fill="none" stroke="#f1f5f9" strokeWidth="1" />)}
                        {rtRadarData.map((_, i) => <line key={i} x1={rtCenterX} y1={rtCenterY} x2={rtCenterX + rtRadius * Math.cos((Math.PI * 2)/6*i - Math.PI/2)} y2={rtCenterY + rtRadius * Math.sin((Math.PI * 2)/6*i - Math.PI/2)} stroke="#f1f5f9" strokeWidth="1" />)}
                        <polygon points={rtPolyPts} fill="rgba(46, 125, 50, 0.2)" stroke="#2E7D32" strokeWidth="2.5" strokeLinejoin="round" />
                        {rtRadarData.map((d, i) => {
                          const angle = (Math.PI * 2) / 6 * i - (Math.PI / 2);
                          const labelR = rtRadius + 22;
                          return <text key={i} x={rtCenterX + labelR * Math.cos(angle)} y={rtCenterY + labelR * Math.sin(angle)} textAnchor="middle" fontSize="11" fontWeight="900" fill="#64748b" dominantBaseline="middle">{d.label}</text>;
                        })}
                      </svg>
                    </div>

                    <div className="grid grid-cols-3 gap-3 w-full mt-6 relative">
                      {rtRadarData.map((d, idx) => (
                        <div key={d.label} className="relative">
                          <div onClick={() => setActiveTooltip(activeTooltip === idx ? null : idx)} className={`bg-gray-50 p-2 rounded-xl border transition-all flex flex-col items-center cursor-pointer ${activeTooltip === idx ? 'border-[#2E7D32] bg-green-50 shadow-inner' : 'border-gray-100'}`}>
                            <div className="flex items-center gap-1 mb-0.5"><span className="text-[10px] text-gray-400 font-black">{d.label}</span><Info size={10} className={activeTooltip === idx ? 'text-[#2E7D32]' : 'text-gray-300'} /></div>
                            <span className={`text-sm font-black ${activeTooltip === idx ? 'text-[#2E7D32]' : 'text-gray-700'}`}>{Math.round(d.score)}</span>
                          </div>
                          {activeTooltip === idx && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 bg-[#1e293b] text-white text-[9px] p-2 rounded-lg shadow-xl z-[110] animate-in fade-in zoom-in">
                              <div className="font-black border-b border-gray-600 pb-1 mb-1 text-green-400">{d.label} 스탯 공식</div>
                              <div className="whitespace-pre-line leading-relaxed opacity-90">{d.desc}</div>
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-[#1e293b]"></div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {activeTooltip !== null && <div className="fixed inset-0 z-[105]" onClick={() => setActiveTooltip(null)}></div>}
                    <p className="text-[9px] text-gray-400 mt-6 font-bold text-center">* 0~100점 척도로 변환된 상대적 지표입니다. (i 클릭 시 공식 확인)</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 💡 세부 분포 모달 (Z-index 120으로 격상하여 무조건 맨 위에 오도록 수정) */}
      {breakdownData && (
        <div className="absolute inset-0 bg-black bg-opacity-60 z-[120] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh]">
            <div className="bg-[#1e293b] p-4 flex justify-between items-center text-white"><h3 className="font-bold text-lg">{breakdownData.title}</h3><button onClick={() => setBreakdownData(null)} className="p-1 hover:bg-gray-700 rounded-full"><X size={20}/></button></div>
            <div className="p-4 overflow-y-auto space-y-3">
              {breakdownData.data.length === 0 ? <p className="text-center text-gray-400 py-4 font-bold text-sm">기록된 데이터가 없습니다.</p> : (
                breakdownData.data.map((item) => {
                  const maxCount = breakdownData.data[0].count; const pct = (item.count / maxCount) * 100;
                  const rankColor = item.rank === 1 ? 'bg-yellow-400' : item.rank === 2 ? 'bg-gray-400' : item.rank === 3 ? 'bg-amber-600' : 'bg-gray-200 text-gray-500';
                  return (
                    <div key={item.name} className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white ${rankColor}`}>{item.rank}</div>
                      <span className="w-20 text-sm font-bold text-gray-700 truncate">{item.name}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-[#2E7D32]" style={{ width: `${pct}%` }}></div></div>
                      <span className="w-8 text-right text-sm font-black text-[#2E7D32]">{item.count}회</span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;