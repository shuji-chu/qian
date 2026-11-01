import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowDownRight, ArrowUpRight, Boxes, Check, ChevronDown, CircleDollarSign,
  Cloud, Database, Globe2, LayoutDashboard, LoaderCircle, LogOut, Menu, RefreshCw,
  Search, Server, ShieldCheck, Users, Wallet, X, AlertTriangle, Power, RotateCw,
  Trash2, Plus, Minus, LockKeyhole
} from 'lucide-react';
import './styles.css';

const API = 'https://domainhub-api.chulingli1988.workers.dev';
const ADMIN_EMAIL = 'boss@lynli.me';
type User = {id:string;email:string;display_name?:string|null;status:string;created_at:string;quota:number};
type Domain = {id:string;domain:string;zone_id:string;status:string;source:string;is_test:number;created_at:string};
type Droplet = {id:number;name:string;status:string;region:string;size:string;ip:string|null;created_at:string};
type Billing = {balance?:{account_balance:string;month_to_date_usage:string;month_to_date_balance:string}|null;billing_history?:{amount:string;date:string;description:string;type:string;invoice_id?:string}[]};

function money(v: unknown, currency='USD') {
  const n=Number(v||0);
  return new Intl.NumberFormat('zh-CN',{style:'currency',currency,maximumFractionDigits:2}).format(Number.isFinite(n)?n:0);
}
function date(v?:string) { if(!v)return '—'; const d=new Date(v); return Number.isNaN(d.getTime())?'—':d.toLocaleString('zh-CN',{hour12:false}); }
function App(){
  const [token,setToken]=useState(localStorage.getItem('domainhub_admin_token')||'');
  const [email,setEmail]=useState(ADMIN_EMAIL),[password,setPassword]=useState('');
  const [loginBusy,setLoginBusy]=useState(false),[busy,setBusy]=useState(false);
  const [section,setSection]=useState('overview'),[mobileNav,setMobileNav]=useState(false);
  const [users,setUsers]=useState<User[]>([]),[domains,setDomains]=useState<Domain[]>([]);
  const [droplets,setDroplets]=useState<Droplet[]>([]),[billing,setBilling]=useState<Billing|null>(null);
  const [query,setQuery]=useState(''),[notice,setNotice]=useState(''),[error,setError]=useState('');
  const [quotaTarget,setQuotaTarget]=useState<User|null>(null),[quotaDelta,setQuotaDelta]=useState('1'),[quotaReason,setQuotaReason]=useState('管理员调整');
  const [lastSync,setLastSync]=useState('');
  const api=useCallback(async(path:string,init:RequestInit={})=>{
    const t=localStorage.getItem('domainhub_admin_token')||token;
    const response=await fetch(API+path,{...init,headers:{'Content-Type':'application/json',...(t?{Authorization:'Bearer '+t}:{}),...(init.headers||{})}});
    const body=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(body.message||body.error||'接口请求失败（HTTP '+response.status+'）');
    return body;
  },[token]);
  const logout=useCallback(()=>{
    localStorage.removeItem('domainhub_admin_token');setToken('');setUsers([]);setDomains([]);setDroplets([]);setBilling(null);setSection('overview');setError('');setNotice('');
  },[]);
  const load=useCallback(async()=>{
    if(!token)return;
    setBusy(true);setError('');
    try{
      const me=await api('/auth/me');
      if(String(me.user?.email||'').toLowerCase()!==ADMIN_EMAIL) throw new Error('当前账户不是授权管理员');
      const results=await Promise.allSettled([
        api('/admin/users'),api('/admin/inventory'),api('/api/servers/list'),api('/api/servers/billing')
      ]);
      if(results[0].status==='fulfilled')setUsers(results[0].value.users||[]);
      else throw results[0].reason;
      if(results[1].status==='fulfilled')setDomains(results[1].value.domains||[]);
      else setError('域名库存读取失败：'+results[1].reason.message);
      if(results[2].status==='fulfilled')setDroplets(results[2].value.droplets||[]);
      else if(results[2].reason?.message?.includes('Token'))setError('DigitalOcean 服务器列表暂不可用：'+results[2].reason.message);
      if(results[3].status==='fulfilled')setBilling(results[3].value);
      else setBilling(null);
    }catch(e:any){setError(e.message||'加载失败');if(/未登录|会话|管理员/.test(e.message||''))logout();}
    finally{setBusy(false);}
  },[token,api,logout]);
  useEffect(()=>{if(token)load();},[token]);
  const login=async(e:React.FormEvent)=>{
    e.preventDefault();setLoginBusy(true);setError('');
    try{
      const d=await api('/auth/login',{method:'POST',body:JSON.stringify({email,password})});
      if(String(d.user?.email||'').toLowerCase()!==ADMIN_EMAIL)throw new Error('该账户没有管理后台权限');
      localStorage.setItem('domainhub_admin_token',d.token);setToken(d.token);setPassword('');
    }catch(e:any){setError(e.message||'登录失败');}
    finally{setLoginBusy(false);}
  };
  const syncInventory=async()=>{
    if(!window.confirm('从 DNSHE 同步域名库存？此操作只更新库存，不会删除或修改已领取域名。'))return;
    setBusy(true);setError('');setNotice('');
    try{const d=await api('/admin/inventory/sync',{method:'POST'});setNotice('同步完成：写入/更新 '+d.synced+' 个域名');setLastSync(new Date().toLocaleString('zh-CN'));const x=await api('/admin/inventory');setDomains(x.domains||[]);}
    catch(e:any){setError(e.message||'同步失败');}finally{setBusy(false);}
  };
  const setStatus=async(u:User)=>{
    const next=u.status==='suspended'?'active':'suspended';
    if(!window.confirm('确认将 '+u.email+' '+(next==='suspended'?'暂停登录':'恢复为正常')+'？'))return;
    try{await api('/admin/users/status',{method:'POST',body:JSON.stringify({userId:u.id,status:next})});setUsers(prev=>prev.map(x=>x.id===u.id?{...x,status:next}:x));setNotice('用户状态已更新');}
    catch(e:any){setError(e.message);}
  };
  const adjustQuota=async(e:React.FormEvent)=>{
    e.preventDefault();if(!quotaTarget)return;
    const delta=Number(quotaDelta);if(!Number.isInteger(delta)||delta===0){setError('配额变动必须为非零整数');return;}
    try{const d=await api('/admin/users/quota',{method:'POST',body:JSON.stringify({userId:quotaTarget.id,delta,reason:quotaReason})});setUsers(prev=>prev.map(x=>x.id===quotaTarget.id?{...x,quota:d.quota}:x));setQuotaTarget(null);setNotice('配额调整成功');}
    catch(e:any){setError(e.message);}
  };
  const serverAction=async(s:Droplet,action:string)=>{
    const labels:any={power_on:'开机',power_off:'关机',reboot:'重启',delete:'删除'};
    if(!window.confirm('确认对服务器 '+s.name+' 执行'+labels[action]+'？'+(action==='delete'?'删除不可恢复。':'')))return;
    try{const d=await api('/api/servers/action',{method:'POST',body:JSON.stringify({id:s.id,action})});setNotice(d.message||'操作已提交');const x=await api('/api/servers/list');setDroplets(x.droplets||[]);}
    catch(e:any){setError(e.message);}
  };
  const filteredUsers=useMemo(()=>users.filter(u=>(u.email+' '+(u.display_name||'')).toLowerCase().includes(query.toLowerCase())),[users,query]);
  const filteredDomains=useMemo(()=>domains.filter(d=>d.domain.toLowerCase().includes(query.toLowerCase())),[domains,query]);
  const activeUsers=users.filter(u=>u.status==='active').length;
  const stats=[{label:'用户总数',value:users.length,icon:Users,delta:'账户记录',tone:'blue'},{label:'正常账户',value:activeUsers,icon:ShieldCheck,delta:'可正常登录',tone:'green'},{label:'域名库存',value:domains.filter(d=>d.status==='available'&&!d.is_test).length,icon:Globe2,delta:'可领取域名',tone:'violet'},{label:'云服务器',value:droplets.length,icon:Server,delta:'当前管理员账户',tone:'amber'}];
  const nav=[{id:'overview',label:'总览',icon:LayoutDashboard},{id:'users',label:'用户管理',icon:Users},{id:'domains',label:'域名库存',icon:Globe2},{id:'servers',label:'云服务器',icon:Server},{id:'billing',label:'账单与费用',icon:Wallet}];
  const title=nav.find(x=>x.id===section)?.label||'总览';
  if(!token)return <div className="login-wrap"><div className="login-card"><div className="brand-mark"><Globe2 size={25}/></div><div className="eyebrow">DOMAINHUB CONTROL CENTER</div><h1>管理后台</h1><p className="login-copy">使用已验证的 DomainHub 管理员账户登录。</p><form onSubmit={login}><label>管理员邮箱<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="username" required/></label><label>账户密码<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/></label>{error&&<div className="alert error"><AlertTriangle size={16}/>{error}</div>}<button className="primary wide" disabled={loginBusy}>{loginBusy?<LoaderCircle className="spin" size={17}/>:<LockKeyhole size={17}/>}安全登录</button></form><div className="login-foot"><ShieldCheck size={14}/> 管理员身份由 DomainHub API 服务端校验</div></div></div>;
  return <div className="app">
    <aside className={'sidebar '+(mobileNav?'open':'')}><div className="brand"><div className="brand-mark"><Globe2 size={23}/></div><div><strong>DomainHub</strong><small>CONTROL CENTER</small></div><button className="close-nav" onClick={()=>setMobileNav(false)}><X size={18}/></button></div>
      <div className="workspace"><span className="workspace-dot"/>运营工作区<ChevronDown size={14}/></div>
      <div className="nav-label">管理控制台</div><nav>{nav.map(n=><button key={n.id} className={section===n.id?'active':''} onClick={()=>{setSection(n.id);setMobileNav(false);setQuery('');}}><n.icon size={18}/><span>{n.label}</span>{section===n.id&&<i/>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="secure"><ShieldCheck size={17}/><div><b>安全连接</b><small>Cloudflare Edge API</small></div></div><button className="logout" onClick={logout}><LogOut size={17}/>退出登录</button></div>
    </aside>
    {mobileNav&&<button className="nav-scrim" onClick={()=>setMobileNav(false)} aria-label="关闭菜单"/>}
    <main className="main"><header className="topbar"><div className="top-left"><button className="menu-btn" onClick={()=>setMobileNav(true)}><Menu/></button><div><div className="crumb">DomainHub / <b>{title}</b></div><h2>{title}</h2></div></div><div className="top-actions"><span className="live"><i/>系统在线</span><button className="icon-btn" onClick={load} title="刷新数据"><RefreshCw size={17}/></button><div className="profile"><div className="avatar">B</div><div><b>管理员</b><small>{ADMIN_EMAIL}</small></div></div></div></header>
      <section className="content">
        {(error||notice)&&<div className={'alert '+(error?'error':'success')}>{error?<AlertTriangle size={17}/>:<Check size={17}/>}<span>{error||notice}</span><button onClick={()=>{setError('');setNotice('')}}><X size={16}/></button></div>}
        {section==='overview'&&<><div className="welcome"><div><div className="eyebrow">SYSTEM OVERVIEW</div><h1>运营概览</h1><p>查看 DomainHub 核心资产、用户与服务运行情况。</p></div><button className="secondary" onClick={load}><RefreshCw size={16}/>刷新数据</button></div><div className="stat-grid">{stats.map(s=><article className="stat-card" key={s.label}><div className={'stat-icon '+s.tone}><s.icon size={20}/></div><div className="stat-label">{s.label}</div><div className="stat-value">{s.value.toLocaleString('zh-CN')}</div><div className="stat-foot">{s.delta}</div></article>)}</div><div className="overview-grid"><article className="panel"><div className="panel-head"><div><h3>快速管理</h3><p>常用管理入口</p></div><Activity size={18}/></div><div className="quick-links">{nav.slice(1).map(n=><button key={n.id} onClick={()=>setSection(n.id)}><span className="quick-icon"><n.icon size={19}/></span><span><b>{n.label}</b><small>{n.id==='users'?'查看账户、调整配额与状态':n.id==='domains'?'同步并查看 DNSHE 域名库存':n.id==='servers'?'查看和管理云服务器实例':'查看账户余额与消费记录'}</small></span><ArrowUpRight size={17}/></button>)}</div></article><article className="panel health-panel"><div className="panel-head"><div><h3>服务状态</h3><p>当前数据连接结果</p></div><Activity size={18}/></div><div className="health-row"><span><Database size={17}/> DomainHub API / D1</span><b className="status-ok">已连接</b></div><div className="health-row"><span><Globe2 size={17}/> DNSHE 库存</span><b>{domains.length?'已读取':'待同步'}</b></div><div className="health-row"><span><Cloud size={17}/> DigitalOcean</span><b>{billing?'已连接':'未读取'}</b></div><div className="health-note">服务器和账单数据取决于 Worker 当前配置的服务商 Token 权限。</div></article></div></>}
        {section==='users'&&<><div className="section-intro"><div><h1>用户管理</h1><p>管理注册账户、账户状态和域名领取配额。</p></div><div className="search-box"><Search size={17}/><input placeholder="搜索邮箱或昵称" value={query} onChange={e=>setQuery(e.target.value)}/></div></div><div className="table-panel"><div className="table-meta"><b>账户列表</b><span>{filteredUsers.length} / {users.length} 个账户</span></div><div className="table-scroll"><table><thead><tr><th>用户</th><th>状态</th><th>当前配额</th><th>注册时间</th><th>管理操作</th></tr></thead><tbody>{filteredUsers.map(u=><tr key={u.id}><td><div className="user-cell"><div className="user-avatar">{(u.display_name||u.email).slice(0,1).toUpperCase()}</div><div><b>{u.display_name||'未设置昵称'}</b><small>{u.email}</small></div></div></td><td><span className={'pill '+(u.status==='active'?'good':'paused')}>{u.status==='active'?'正常':'已暂停'}</span></td><td><b className="quota">{u.quota}</b></td><td>{date(u.created_at)}</td><td><div className="row-actions"><button className="small-btn" onClick={()=>{setQuotaTarget(u);setQuotaDelta('1');setQuotaReason('管理员调整');}}><Plus size={14}/>调整配额</button><button className={'small-btn '+(u.status==='active'?'danger':'')} onClick={()=>setStatus(u)}>{u.status==='active'?'暂停账户':'恢复账户'}</button></div></td></tr>)}</tbody></table>{!filteredUsers.length&&<div className="empty">没有匹配的用户记录</div>}</div></div></>}
        {section==='domains'&&<><div className="section-intro"><div><h1>域名库存</h1><p>管理从 DNSHE 同步的域名库存；不会触碰已领取域名。</p></div><button className="primary" onClick={syncInventory} disabled={busy}><RefreshCw size={16} className={busy?'spin':''}/>同步 DNSHE 库存</button></div><div className="mini-stats"><div><span>库存记录</span><b>{domains.length}</b></div><div><span>可领取</span><b>{domains.filter(d=>d.status==='available'&&!d.is_test).length}</b></div><div><span>已领取</span><b>{domains.filter(d=>d.status==='claimed').length}</b></div><div><span>测试数据</span><b>{domains.filter(d=>!!d.is_test).length}</b></div></div><div className="table-panel"><div className="table-meta"><b>域名清单</b><div className="search-box compact"><Search size={16}/><input placeholder="搜索域名" value={query} onChange={e=>setQuery(e.target.value)}/></div></div><div className="table-scroll"><table><thead><tr><th>域名</th><th>库存状态</th><th>来源</th><th>创建时间</th></tr></thead><tbody>{filteredDomains.map(d=><tr key={d.id}><td><b>{d.domain}</b><small className="sub-id">{d.zone_id}</small></td><td><span className={'pill '+(d.status==='available'?'good':d.status==='claimed'?'blue-pill':'paused')}>{d.is_test?'测试库存':d.status==='available'?'可领取':d.status==='claimed'?'已领取':d.status}</span></td><td>{d.source||'—'}</td><td>{date(d.created_at)}</td></tr>)}</tbody></table>{!filteredDomains.length&&<div className="empty">暂无库存数据，请先同步 DNSHE</div>}</div></div>{lastSync&&<p className="last-sync">最近同步：{lastSync}</p>}</>}
        {section==='servers'&&<><div className="section-intro"><div><h1>云服务器</h1><p>当前接口仅返回管理员账户标签下的 Droplet；操作会直接影响真实资源。</p></div><button className="secondary" onClick={load}><RefreshCw size={16}/>刷新列表</button></div><div className="warning-note"><AlertTriangle size={17}/>开关机、重启和删除均为真实 DigitalOcean 操作。删除不可恢复；请操作前核对服务器名称和 IP。</div><div className="server-grid">{droplets.map(s=><article className="server-card" key={s.id}><div className="server-top"><span className="server-symbol"><Server size={20}/></span><span className={'pill '+(s.status==='active'?'good':'paused')}>{s.status}</span></div><h3>{s.name}</h3><p>{s.region} · {s.size}</p><div className="server-ip">{s.ip||'暂无公网 IP'}</div><div className="server-id">ID {s.id}</div><div className="server-actions"><button onClick={()=>serverAction(s,'power_on')}><Power size={14}/>开机</button><button onClick={()=>serverAction(s,'power_off')}><Power size={14}/>关机</button><button onClick={()=>serverAction(s,'reboot')}><RotateCw size={14}/>重启</button><button className="delete-action" onClick={()=>serverAction(s,'delete')}><Trash2 size={14}/>删除</button></div></article>)}{!droplets.length&&<div className="empty-card"><Server size={26}/><b>暂无可管理服务器</b><span>若账户已有 Droplet，请确认其带有 DomainHub 管理员标签，且 DigitalOcean Token 具备读取权限。</span></div>}</div></>}
        {section==='billing'&&<><div className="section-intro"><div><h1>账单与费用</h1><p>来自 DigitalOcean 账户级账单接口的实时返回。</p></div><button className="secondary" onClick={load}><RefreshCw size={16}/>刷新账单</button></div>{billing?.balance?<div className="billing-cards"><article><span>账户余额</span><b>{money(billing.balance.account_balance)}</b></article><article><span>本月使用量</span><b>{money(billing.balance.month_to_date_usage)}</b></article><article><span>本月余额</span><b>{money(billing.balance.month_to_date_balance)}</b></article></div>:<div className="warning-note"><AlertTriangle size={17}/>账单数据暂不可用。请确认 Worker 的 DigitalOcean Token 具有 billing:read 权限。</div>}<div className="table-panel"><div className="table-meta"><b>消费与账单记录</b><span>{billing?.billing_history?.length||0} 条</span></div><div className="table-scroll"><table><thead><tr><th>日期</th><th>说明</th><th>类型</th><th>金额</th></tr></thead><tbody>{(billing?.billing_history||[]).map((x,i)=><tr key={x.invoice_id||i}><td>{date(x.date)}</td><td>{x.description||'—'}</td><td>{x.type||'—'}</td><td className="amount">{money(x.amount)}</td></tr>)}</tbody></table>{!billing?.billing_history?.length&&<div className="empty">暂无账单记录或接口权限不足</div>}</div></div></>}
      </section>
    </main>
    {quotaTarget&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setQuotaTarget(null);}}><form className="modal" onSubmit={adjustQuota}><button type="button" className="modal-close" onClick={()=>setQuotaTarget(null)}><X size={18}/></button><div className="modal-icon"><CircleDollarSign size={22}/></div><h3>调整用户配额</h3><p>{quotaTarget.email}</p><label>配额变动（正数增加，负数扣减）<input type="number" step="1" value={quotaDelta} onChange={e=>setQuotaDelta(e.target.value)} required/></label><label>调整原因<input value={quotaReason} onChange={e=>setQuotaReason(e.target.value)} maxLength={120} required/></label><div className="modal-actions"><button type="button" className="secondary" onClick={()=>setQuotaTarget(null)}>取消</button><button className="primary">确认调整</button></div></form></div>}
    {busy&&<div className="busy-indicator"><LoaderCircle size={16} className="spin"/>正在同步数据</div>}
  </div>;
}
export default App;
