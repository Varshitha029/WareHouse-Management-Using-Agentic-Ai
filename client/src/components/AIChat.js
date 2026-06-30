import React, { useState, useRef, useEffect } from 'react';





import {





  Fab, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton,





  Typography, Box, Paper, Avatar, CircularProgress, Chip, Tooltip, Badge





} from '@mui/material';





import {





  SmartToy, Send, Close, Mic, MicOff, ContentCopy, Refresh,





  Inventory2, TrendingUp, Schedule, AccountBalance, BugReport, AutoAwesome





} from '@mui/icons-material';





import { useAuth } from '../contexts/AuthContext';





import axios from 'axios';











// --- Agent metadata â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€





const AGENT_INFO = {


  chat:          { name: 'WMS Assistant',           icon: 'AI',  color: '#667eea', muiColor: '#667eea' },


  inventory:     { name: 'Inventory Agent',         icon: 'INV', color: '#4caf50', muiColor: '#4caf50' },


  weighbridge:   { name: 'Weighbridge Agent',       icon: 'WB',  color: '#ff9800', muiColor: '#ff9800' },


  duration:      { name: 'Storage Duration Agent',  icon: 'DUR', color: '#2196f3', muiColor: '#2196f3' },


  loan_risk:     { name: 'Loan Risk Agent',         icon: 'LOAN',color: '#9c27b0', muiColor: '#9c27b0' },


  pricing:       { name: 'Market Pricing Agent',    icon: 'MKT', color: '#f44336', muiColor: '#f44336' },


  anomaly:       { name: 'Anomaly Detection Agent', icon: 'SEC', color: '#795548', muiColor: '#795548' },


  full_analysis: { name: 'Full AI Analysis',        icon: 'ALL', color: '#3f51b5', muiColor: '#3f51b5' },


};











// --- Quick-action shortcuts shown above the input â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€





const QUICK_ACTIONS = [





  {





    label: 'Inventory',





    icon: <Inventory2 sx={{ fontSize: 16 }} />,





    message: 'Analyze current inventory status and storage utilization',





    color: '#4caf50',





    agent: 'inventory',





  },





  {





    label: 'Market Prices',





    icon: <TrendingUp sx={{ fontSize: 16 }} />,





    message: 'Show current grain market prices and 3-month price predictions',





    color: '#f44336',





    agent: 'pricing',





  },





  {





    label: 'Storage Duration',





    icon: <Schedule sx={{ fontSize: 16 }} />,





    message: 'Predict optimal storage duration for all grains currently stored',





    color: '#2196f3',





    agent: 'duration',





  },





  {





    label: 'Loan Risk',





    icon: <AccountBalance sx={{ fontSize: 16 }} />,





    message: 'Analyze the loan portfolio risk and summary',





    color: '#9c27b0',





    agent: 'loan_risk',





  },





  {





    label: 'Anomaly Scan',





    icon: <BugReport sx={{ fontSize: 16 }} />,





    message: 'Run an anomaly and fraud detection scan across all operations',





    color: '#795548',





    agent: 'anomaly',





  },





];











const AIChat = () => {





  const [open, setOpen]             = useState(false);





  const welcomeMsg =





    "Hello! I'm your **WMS AI Master Assistant**\n\n" +





    "I coordinate 5 specialist AI agents:\n" +





    "  [INV]  **Inventory Agent** -- capacity & storage\n" +





    "  [MKT]  **Market Pricing Agent** -- prices & sell timing\n" +





    "  [DUR]  **Storage Duration Agent** -- optimal hold periods\n" +





    "  [LOAN] **Loan Risk Agent** -- credit & portfolio risk\n" +





    "  [SEC]  **Anomaly Detection Agent** -- fraud & alerts\n\n" +





    "Ask me anything or click the quick-action buttons below!";











  const [messages, setMessages]     = useState([





    { role: 'assistant', content: welcomeMsg, agent: 'chat' },





  ]);





  const [input, setInput]           = useState('');





  const [loading, setLoading]       = useState(false);





  const [consultingAgent, setConsultingAgent] = useState(null); // shown while loading





  const [isListening, setIsListening] = useState(false);





  const messagesEndRef  = useRef(null);





  const recognitionRef  = useRef(null);





  const { user }        = useAuth();

  const chatStorageKey = `wms_ai_chat_messages_${user?._id || user?.id || user?.username || 'anonymous'}`;











  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });





  useEffect(scrollToBottom, [messages]);

  // Restore persisted chat history for the logged-in customer.
  useEffect(() => {
    if (!user) return;

    try {
      const raw = localStorage.getItem(chatStorageKey);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setMessages(parsed);
      }
    } catch (e) {
      console.warn('Failed to restore AI chat history:', e);
    }
  }, [chatStorageKey, user]);

  // Persist chat history so it remains until user explicitly clears it.
  useEffect(() => {
    if (!user) return;

    try {
      localStorage.setItem(chatStorageKey, JSON.stringify(messages));
    } catch (e) {
      console.warn('Failed to persist AI chat history:', e);
    }
  }, [chatStorageKey, messages, user]);











  // â”€â”€ Speech recognition â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€





  useEffect(() => {





    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {





      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;





      recognitionRef.current = new SR();





      recognitionRef.current.continuous     = false;





      recognitionRef.current.interimResults = true;





      recognitionRef.current.lang           = 'en-IN';





      recognitionRef.current.onresult = (e) =>





        setInput(Array.from(e.results).map(r => r[0].transcript).join(''));





      recognitionRef.current.onend  = () => setIsListening(false);





      recognitionRef.current.onerror = () => setIsListening(false);





    }





  }, []);











  const toggleListening = () => {





    if (!recognitionRef.current) return alert('Speech recognition not supported.');





    if (isListening) { recognitionRef.current.stop(); setIsListening(false); }





    else             { recognitionRef.current.start(); setIsListening(true); }





  };











  // â”€â”€ Build history array to send to backend â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€





  const buildHistory = () =>





    messages





      .filter(m => m.role === 'user' || m.role === 'assistant')





      .slice(-20)





      .map(m => ({ role: m.role, content: m.content }));











  // â”€â”€ Send a chat message â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€





  const sendMessage = async (overrideText = null) => {





    const text = (overrideText || input).trim();





    if (!text || loading) return;





    setInput('');











    const userMsg = { role: 'user', content: text };





    setMessages(prev => [...prev, userMsg]);





    setLoading(true);





    setConsultingAgent(null);











    try {





      const response = await axios.post('/api/ai/chat', {





        message: text,





        context: {





          userRole: user?.role,





          userId:   user?._id,





          username: user?.username,





          history:  buildHistory(),





        },





      });











      const data      = response.data;





      // Handle multiple response shapes:





      // 1. Direct AI engine:  { success, data: { reply }, agent, agentInfo }





      // 2. n8n wrapper:       { workflow, status, results: { data: { reply }, agent } }





      // 3. Legacy:            { response } or { message }





      const n8nResults = data?.results;





      const reply =





        n8nResults?.data?.reply       ||





        n8nResults?.data?.data?.reply ||





        data?.data?.reply             ||





        data?.reply                   ||





        data?.response                ||





        n8nResults?.message           ||





        data?.message                 ||





        'The AI Engine did not return a reply. Make sure the AI Engine (api.py) is running on port 8001.';





      const agentKey  = data?.agent || n8nResults?.agent || 'chat';





      const agentMeta = data?.agentInfo || n8nResults?.agentInfo || AGENT_INFO[agentKey] || AGENT_INFO.chat;











      setMessages(prev => [...prev, {





        role:          'assistant',





        content:       reply,





        agent:         agentKey,





        agentInfo:     agentMeta,





        specialistData: data?.specialistData || null,





      }]);





    } catch (err) {





      setMessages(prev => [...prev, {





        role:      'assistant',





        content:   getFallbackResponse(text, user?.role),





        agent:     'chat',





        agentInfo: AGENT_INFO.chat,





      }]);





    } finally {





      setLoading(false);





      setConsultingAgent(null);





    }





  };











  // â”€â”€ Full Analysis - triggers all 5 agents â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€





  const sendFullAnalysis = async () => {





    if (loading) return;





    setLoading(true);





    setConsultingAgent('full_analysis');











    const userMsg = {





      role: 'user',





      content: '[SCAN] Run Full AI Analysis across all systems',





    };





    setMessages(prev => [...prev, userMsg]);











    try {





      const response = await axios.post('/api/ai/full-analysis', {





        role:   user?.role,





        userId: user?._id,





      });











      const data  = response.data;





      const reply = data?.data?.reply   ||
        data?.data?.message ||
        data?.reply         ||
        data?.response      ||
        (data?.message !== 'Full AI analysis complete' ? data?.message : null) ||
        'Full analysis complete � check the breakdown below for details.';











      setMessages(prev => [...prev, {





        role:           'assistant',





        content:        reply,





        agent:          'full_analysis',





        agentInfo:      AGENT_INFO.full_analysis,





        specialistData: data?.data?.breakdown || null,





        isFullAnalysis: true,





      }]);





    } catch (err) {





      setMessages(prev => [...prev, {





        role:      'assistant',





        content:   '[!] Full analysis failed. Make sure the AI Engine is running.',





        agent:     'chat',





        agentInfo: AGENT_INFO.chat,





      }]);





    } finally {





      setLoading(false);





      setConsultingAgent(null);





    }





  };











  // â”€â”€ Fallback when AI is offline â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€





  const getFallbackResponse = (q, role) => {





    const lq = q.toLowerCase();





    if (role === 'owner') {





      if (lq.includes('revenue') || lq.includes('income'))     return 'View revenue details in the Analytics tab. The AI Engine needs to be running for ML-powered insights.';





      if (lq.includes('inventory') || lq.includes('stock'))    return 'Check Warehouse Layout for current inventory. Start the AI Engine for smart analysis.';





      if (lq.includes('loan'))                                  return 'The Loan Portfolio tab shows all loan statuses. AI risk scoring requires the AI Engine.';





      if (lq.includes('price') || lq.includes('market'))       return 'Visit Market & Predictions for live prices. Extended AI forecasting requires the AI Engine.';





      if (lq.includes('fraud') || lq.includes('anomaly'))      return 'Anomaly detection requires the AI Engine to be running on port 8001.';





      return 'Start the AI Engine (run `python api.py` in the ai-engine folder) for full intelligence.';





    }





    if (lq.includes('loan'))    return 'Check the Loan Calculator tab for your eligibility.';





    if (lq.includes('price'))   return 'Visit Market & Predictions for live grain prices.';





    if (lq.includes('storage')) return 'Storage details are in your Grain Locations tab.';





    return 'I can help with grain storage, market prices, and loans. What do you need?';





  };











  const handleKeyPress = (e) => {





    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }





  };











  const copyMessage = (content) => navigator.clipboard.writeText(content);











  if (!user) return null;











  // â”€â”€ Loading label â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€





  const loadingLabel = consultingAgent





    ? `${AGENT_INFO[consultingAgent]?.icon || 'AI'} Consulting ${AGENT_INFO[consultingAgent]?.name || 'AI'}...`





    : 'Thinking...';











  return (





    <>





      {/* â”€â”€ Floating Button â”€â”€ */}





      <Tooltip title="WMS AI Master Assistant" placement="left">





        <Fab





          color="primary"





          onClick={() => setOpen(true)}





          sx={{





            position: 'fixed', bottom: 24, right: 24, zIndex: 1000,





            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',





            '&:hover': { background: 'linear-gradient(135deg, #5a6fd6 0%, #6a4299 100%)' },





            width: 64, height: 64,





          }}





        >





          <Badge





            badgeContent={messages.filter(m => m.role === 'assistant').length > 1 ? '*' : null}





            color="error"





            sx={{ '& .MuiBadge-badge': { fontSize: 10 } }}





          >





            <SmartToy sx={{ fontSize: 32 }} />





          </Badge>





        </Fab>





      </Tooltip>











      {/* â”€â”€ Chat Dialog â”€â”€ */}





      <Dialog





        open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth





        PaperProps={{ sx: { height: '85vh', maxHeight: 750, borderRadius: 3, display: 'flex', flexDirection: 'column' } }}





      >





        {/* Header */}





        <DialogTitle sx={{





          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',





          color: 'white', display: 'flex', alignItems: 'center',





          justifyContent: 'space-between', py: 1.5,





        }}>





          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>





            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 40, height: 40 }}>





              <SmartToy sx={{ fontSize: 22 }} />





            </Avatar>





            <Box>





              <Typography variant="h6" fontWeight="bold" sx={{ lineHeight: 1.2 }}>





                WMS AI Master Assistant





              </Typography>





              <Typography variant="caption" sx={{ opacity: 0.85 }}>





                {user?.role === 'owner' ? '5 specialist agents' : 'Customer mode'} - {user?.username}





              </Typography>





            </Box>





          </Box>





          <Box sx={{ display: 'flex', gap: 0.5 }}>





            <Tooltip title="Clear chat">





              <IconButton





                size="small"





                onClick={() => {
                  localStorage.removeItem(chatStorageKey);
                  setMessages([{ role: 'assistant', content: 'Chat cleared. How can I help?', agent: 'chat' }]);
                }}





                sx={{ color: 'rgba(255,255,255,0.8)' }}





              >





                <Refresh sx={{ fontSize: 18 }} />





              </IconButton>





            </Tooltip>





            <IconButton onClick={() => setOpen(false)} sx={{ color: 'white' }}>





              <Close />





            </IconButton>





          </Box>





        </DialogTitle>











        {/* Messages */}





        <DialogContent sx={{ flex: 1, overflow: 'auto', p: 2, bgcolor: '#f5f5f5' }}>





          {messages.map((msg, idx) => (





            <Box key={idx} sx={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', mb: 2 }}>





              <Box sx={{ display: 'flex', gap: 1, maxWidth: '90%', alignItems: 'flex-start' }}>





                {msg.role === 'assistant' && (





                  <Avatar sx={{





                    bgcolor: msg.agentInfo?.color || '#764ba2',





                    width: 32, height: 32, mt: 0.5, fontSize: 16,





                  }}>





                    {msg.agentInfo?.icon || 'AI'}





                  </Avatar>





                )}











                <Box>





                  <Paper elevation={1} sx={{





                    p: 1.5, borderRadius: 2,





                    bgcolor: msg.role === 'user' ? '#1976d2' : 'white',





                    color:   msg.role === 'user' ? 'white' : 'text.primary',





                    position: 'relative',





                    borderLeft: msg.role === 'assistant' && msg.agentInfo?.color





                      ? `3px solid ${msg.agentInfo.color}` : undefined,





                  }}>





                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>





                      {/* Render **bold** text */}





                      {msg.content.split(/\*\*(.*?)\*\*/g).map((part, i) =>





                        i % 2 === 1





                          ? <strong key={i}>{part}</strong>





                          : part





                      )}





                    </Typography>





                    {msg.role === 'assistant' && (





                      <IconButton





                        size="small"





                        onClick={() => copyMessage(msg.content)}





                        sx={{ position: 'absolute', top: 2, right: 2, opacity: 0.4, '&:hover': { opacity: 1 } }}





                      >





                        <ContentCopy sx={{ fontSize: 12 }} />





                      </IconButton>





                    )}





                  </Paper>











                  {/* Agent chip below assistant message */}





                  {msg.role === 'assistant' && msg.agent && msg.agent !== 'chat' && (





                    <Box sx={{ mt: 0.5, ml: 0.5 }}>





                      <Chip





                        label={`${msg.agentInfo?.icon || ''} ${msg.agentInfo?.name || msg.agent}`}





                        size="small"





                        sx={{





                          fontSize: '0.65rem', height: 20,





                          bgcolor: msg.agentInfo?.color || '#667eea',





                          color: 'white', fontWeight: 600,





                        }}





                      />





                    </Box>





                  )}





                </Box>











                {msg.role === 'user' && (





                  <Avatar sx={{ bgcolor: '#1976d2', width: 32, height: 32, mt: 0.5, fontSize: 13 }}>





                    {user?.username?.[0]?.toUpperCase() || 'U'}





                  </Avatar>





                )}





              </Box>





            </Box>





          ))}











          {/* Loading indicator */}





          {loading && (





            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>





              <Avatar sx={{ bgcolor: '#764ba2', width: 32, height: 32, fontSize: 16 }}>WMS</Avatar>





              <Paper sx={{ p: 1.5, borderRadius: 2 }}>





                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>





                  <CircularProgress size={14} />





                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>





                    {loadingLabel}





                  </Typography>





                </Box>





              </Paper>





            </Box>





          )}





          <div ref={messagesEndRef} />





        </DialogContent>











        {/* Quick actions */}





        {user?.role === 'owner' && (





          <Box sx={{ px: 2, pt: 1, bgcolor: 'white', borderTop: '1px solid #eee' }}>





            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>





              Quick Actions:





            </Typography>





            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>





              {QUICK_ACTIONS.map((qa) => (





                <Chip





                  key={qa.agent}





                  icon={qa.icon}





                  label={qa.label}





                  size="small"





                  clickable





                  disabled={loading}





                  onClick={() => sendMessage(qa.message)}





                  sx={{





                    fontSize: '0.7rem',





                    bgcolor: qa.color + '15',





                    color: qa.color,





                    border: `1px solid ${qa.color}40`,





                    '&:hover': { bgcolor: qa.color + '30' },





                    '& .MuiChip-icon': { color: qa.color },





                  }}





                />





              ))}





              <Chip





                icon={<AutoAwesome sx={{ fontSize: 14 }} />}





                label="Full Analysis"





                size="small"





                clickable





                disabled={loading}





                onClick={sendFullAnalysis}





                sx={{





                  fontSize: '0.7rem',





                  bgcolor: '#3f51b530',





                  color: '#3f51b5',





                  border: '1px solid #3f51b540',





                  fontWeight: 700,





                  '&:hover': { bgcolor: '#3f51b540' },





                  '& .MuiChip-icon': { color: '#3f51b5' },





                }}





              />





            </Box>





          </Box>





        )}











        {/* Input area */}





        <DialogActions sx={{ p: 1.5, bgcolor: 'white', borderTop: user?.role !== 'owner' ? '1px solid #eee' : undefined }}>





          <Box sx={{ display: 'flex', width: '100%', gap: 1 }}>





            <IconButton





              onClick={toggleListening}





              color={isListening ? 'error' : 'default'}





              size="small"





              sx={{





                animation: isListening ? 'pulse 1.5s ease-in-out infinite' : 'none',





                '@keyframes pulse': {





                  '0%':   { boxShadow: '0 0 0 0 rgba(244,67,54,.4)' },





                  '70%':  { boxShadow: '0 0 0 10px rgba(244,67,54,0)' },





                  '100%': { boxShadow: '0 0 0 0 rgba(244,67,54,0)' },





                },





              }}





            >





              {isListening ? <MicOff /> : <Mic />}





            </IconButton>





            <TextField





              fullWidth size="small"





              placeholder="Ask anything about your warehouse..."





              value={input}





              onChange={(e) => setInput(e.target.value)}





              onKeyPress={handleKeyPress}





              multiline maxRows={3}





              disabled={loading}





              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}





            />





            <IconButton





              onClick={() => sendMessage()}





              disabled={!input.trim() || loading}





              sx={{





                bgcolor: 'primary.main', color: 'white',





                '&:hover': { bgcolor: 'primary.dark' },





                '&.Mui-disabled': { bgcolor: '#e0e0e0' },





              }}





            >





              <Send />





            </IconButton>





          </Box>





        </DialogActions>





      </Dialog>





    </>





  );





};











export default AIChat;





