import { Link } from 'react-router-dom';
import { ButtonLink } from '../ui';

const sections = [
  { title: '宠物照护', text: '从宠物档案出发，查看适合它年龄与品种的饮食、护理建议。', image: '/images/care.webp', to: '/pets', action: '查看照护' },
  { title: '纪念空间', text: '用照片和故事布置一个小角落，把与你相伴的时光收藏起来。', image: '/images/memorial.webp', to: '/memories', action: '布置回忆角' },
  { title: '周边商城', text: '选一件日常用品，或把照片和名字做成专属于它的纪念物。', image: '/images/bowls.webp', to: '/shop', action: '浏览商品' },
];

export function Home() {
  return <main className="home-shell">
    <section className="hero" aria-labelledby="hero-title">
      <picture className="hero-picture"><img src="/images/hero.webp" alt="依偎在沙发上的金毛犬和猫" fetchPriority="high" /></picture>
      <div className="hero-copy">
        <h1 id="hero-title">把毛孩子的<br className="hero-line-break" />日子<span>好好珍藏。</span></h1>
        <p>从今天的照护，到往日的回忆。<br />这里存放你和它一起走过的时光。</p>
        <div className="hero-actions"><ButtonLink to="/pets/new">创建宠物档案</ButtonLink><ButtonLink to="/memories" secondary>探索纪念空间</ButtonLink></div>
      </div>
    </section>
    <section className="home-sections" aria-labelledby="home-sections-title">
      <div className="home-section-heading"><h2 id="home-sections-title">和它有关的小事</h2></div>
      <div className="journey-grid">
        {sections.map(section => <article className="journey-card" key={section.to}>
          <Link to={section.to} className="journey-image" tabIndex={-1} aria-hidden="true"><img src={section.image} alt="" loading="lazy" /></Link>
          <div className="journey-copy"><h3>{section.title}</h3><p>{section.text}</p><Link className="text-link" to={section.to}>{section.action}</Link></div>
        </article>)}
      </div>
    </section>
  </main>;
}
