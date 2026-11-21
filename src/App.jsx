import React, { Suspense, lazy, useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LuLayoutDashboard, LuLibrary, LuHistory, LuSettings, LuWandSparkles, LuMenu, LuX } from 'react-icons/lu';
import * as store from './lib/store.js';
import { Overlays, toast } from './components/ui.jsx';
import { Logo } from './components/Logo.jsx';
const TestRunner = lazy(() => import('./test/TestRunner.jsx'));
import Dashboard from './pages/Dashboard.jsx';
const Library = lazy(() => import('./pages/Library.jsx'));
const History = lazy(() => import('./pages/History.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const Generator = lazy(() => import('./pages/Generator.jsx'));
const Evaluating = lazy(() => import('./pages/Evaluating.jsx'));
const Report = lazy(() => import('./pages/Report.jsx'));
import { cx } from './lib/util.js';

const PageLoading = ({ full }) => (
  <div className={cx('flex items-center justify-center', full ? 'h-screen bg-white text-slate-500' : 'py-24 text-slate-400')}>
    <motion.div className="h-8 w-8 rounded-full border-2 border-current border-t-transparent" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} />
  </div>
);

class Boundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error(err, info); }
  render() {
    if (!this.state.err) return this.props.children;
    return (<div className="glass mx-auto max-w-xl p-8 text-center"><h2 className="mb-2 text-xl font-bold">Something went wrong on this page</h2><p className="mb-5 text-sm text-slate-400">{String(this.state.err.message || this.state.err)}</p><button className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold" onClick={() => { this.setState({ err: null }); location.hash = '#/'; }}>Back to dashboard</button></div>);
  }
}

/* tiny hash router: #/, #/library, #/history, #/settings, #/generate, #/report/<id> */
const parse = () => { const h = (location.hash || '#/').slice(2).split('/'); return { name: h[0] || 'home', arg: h[1] }; };
export const go = (path) => { location.hash = '#/' + path; };

const NAV = [['', 'Dashboard', LuLayoutDashboard], ['library', 'Test Library', LuLibrary], ['history', 'History', LuHistory], ['generate', 'AI Generator', LuWandSparkles], ['settings', 'Settings', LuSettings]];

/* App-wide "start practice" entry point used by every page */
export const startBus = { fn: null };
export const startPractice = planPromise => startBus.fn && startBus.fn(planPromise);

export default function App() {
  const [route, setRoute] = useState(parse());
  const [active, setActive] = useState(null);   // running test plan
  const [evaluating, setEvaluating] = useState(null); // submitted session
  const [menu, setMenu] = useState(false);
  useSyncExternalStore(store.subscribe, () => store.get('history', []).length + ':' + JSON.stringify(store.get('settings', {})).length);
  useEffect(() => { const f = () => { setRoute(parse()); setMenu(false); window.scrollTo(0, 0); }; window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);

  startBus.fn = useCallback(async planPromise => {
    try { const plan = await planPromise; setActive(plan); }
    catch (e) { console.error(e); toast('Could not load that test: ' + e.message, 'error'); }
  }, []);

  if (active) return (<><Suspense fallback={<PageLoading full />}><TestRunner plan={active} onExit={() => setActive(null)} onFinish={session => { setActive(null); setEvaluating(session); }} /></Suspense><Overlays /></>);
  if (evaluating) return (<Shell route={{ name: 'eval' }} menu={menu} setMenu={setMenu}><Suspense fallback={<PageLoading />}><Evaluating session={evaluating} onDone={id => { setEvaluating(null); go('report/' + id); }} /></Suspense></Shell>);

  let page;
  switch (route.name) {
    case 'library': page = <Library />; break;
    case 'history': page = <History />; break;
    case 'settings': page = <Settings />; break;
    case 'generate': page = <Generator />; break;
    case 'report': page = <Report id={route.arg} />; break;
    default: page = <Dashboard />;
  }
  return <Shell route={route} menu={menu} setMenu={setMenu}><AnimatePresence mode="wait"><motion.div key={route.name + (route.arg || '')} data-route={route.name} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}><Boundary key={route.name + (route.arg || "")}><Suspense fallback={<PageLoading />}>{page}</Suspense></Boundary></motion.div></AnimatePresence></Shell>;
}

function Shell({ route, children, menu, setMenu }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* animated background */}
      <div className="bg-blobs pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-brand-600/25 blur-[120px] animate-float" />
        <div className="absolute right-[-160px] top-1/4 h-[460px] w-[460px] rounded-full bg-cyan-500/15 blur-[120px] animate-float [animation-delay:-5s]" />
        <div className="absolute bottom-[-200px] left-1/3 h-[520px] w-[520px] rounded-full bg-fuchsia-600/15 blur-[130px] animate-float [animation-delay:-9s]" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      </div>
      <header className="app-nav no-print sticky top-0 z-40 border-b border-white/10 bg-ink-950/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5">
          <a href="#/" className="flex items-center gap-2.5"><Logo /><span className="text-lg font-extrabold tracking-tight">CELPIP <span className="text-gradient">Guru</span></span></a>
          <nav className="hidden items-center gap-1 lg:flex">
            {NAV.map(([p, label, Icon]) => {
              const on = (route.name === 'home' && p === '') || route.name === p;
              return (
                <a key={p} href={'#/' + p} className={cx('relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors', on ? 'text-white' : 'text-slate-400 hover:text-white')}>
                  {on && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-xl border border-white/10 bg-white/10" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />}
                  <Icon className="relative" /><span className="relative">{label}</span>
                </a>
              );
            })}
          </nav>
          <button className="rounded-lg p-2 text-xl lg:hidden" onClick={() => setMenu(!menu)} aria-label="Menu">{menu ? <LuX /> : <LuMenu />}</button>
        </div>
        <AnimatePresence>{menu && (
          <motion.nav initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-white/10 lg:hidden">
            <div className="flex flex-col p-3">{NAV.map(([p, label, Icon]) => <a key={p} href={'#/' + p} className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-semibold text-slate-300 hover:bg-white/10"><Icon />{label}</a>)}</div>
          </motion.nav>)}
        </AnimatePresence>
      </header>
      <main className="relative z-10 mx-auto max-w-7xl px-5 pb-20 pt-8">{children}</main>
      <footer className="no-print relative z-10 border-t border-white/10 py-8 text-center text-xs leading-relaxed text-slate-500">
        CELPIP Guru is an independent, unofficial practice tool with original content. CELPIP is a trademark of its owner; this site is not affiliated with or endorsed by Paragon Testing Enterprises.<br />Scores are estimates for practice only. Your data stays in this browser.
      </footer>
      <Overlays />
    </div>
  );
}
