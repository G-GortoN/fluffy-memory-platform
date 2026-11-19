import { Link } from 'react-router-dom';
import { useLanguage } from '../language';
import { ButtonLink } from '../ui';

export function Home() {
  const { t } = useLanguage();
  const sections = [
    {
      title: t('宠物照护', 'Pet care', '寵物照顧'),
      text: t('从宠物档案出发，查看适合它年龄与品种的饮食、护理建议。', 'Get feeding and care advice for your pet’s age and breed.', '建立寵物檔案，查看適合牠年齡及品種的飲食和護理建議。'),
      image: '/images/care.webp', to: '/pets', action: t('查看照护', 'Explore pet care', '查看照顧建議'),
    },
    {
      title: t('纪念空间', 'Memorials', '紀念空間'),
      text: t('用照片和故事布置一个小角落，把与你相伴的时光收藏起来。', 'Give your favourite photos and stories a quiet place to stay.', '用相片和故事佈置一個小角落，珍藏彼此相伴的時光。'),
      image: '/images/memorial.webp', to: '/memories', action: t('布置回忆角', 'Create a memorial', '佈置回憶角'),
    },
    {
      title: t('周边商城', 'Pet shop', '網上商店'),
      text: t('选一件日常用品，或把照片和名字做成专属于它的纪念物。', 'Shop for everyday essentials and personalise keepsakes with a name or photo.', '選購日常用品，或用名字和相片製作一份專屬紀念品。'),
      image: '/images/bowls.webp', to: '/shop', action: t('浏览商品', 'Browse the shop', '瀏覽貨品'),
    },
  ];
  return <main className="home-shell">
    <section className="hero" aria-labelledby="hero-title">
      <picture className="hero-picture"><img src="/images/hero.webp" alt={t('依偎在沙发上的金毛犬和猫', 'A golden retriever and a cat curled up on a sofa', '依偎在梳化上的金毛尋回犬和貓')} fetchPriority="high" /></picture>
      <div className="hero-copy">
        <h1 id="hero-title">{t('把毛孩子的', 'Keep their', '把毛孩的')}<br className="hero-line-break" />{t('日子', ' ', '日子')}<span>{t('好好珍藏。', 'memory close.', '好好珍藏。')}</span></h1>
        <p>{t('从今天的照护，到往日的回忆。', 'From everyday care to memories of days gone by.', '由今天的照顧，到昔日的回憶。')}<br />{t('这里存放你和它一起走过的时光。', 'A place for the time you share with them.', '在這裏珍藏你和牠一起走過的時光。')}</p>
        <div className="hero-actions"><ButtonLink to="/pets/new">{t('创建宠物档案', 'Create a pet profile', '建立寵物檔案')}</ButtonLink><ButtonLink to="/memories" secondary>{t('探索纪念空间', 'Explore memorials', '探索紀念空間')}</ButtonLink></div>
      </div>
    </section>
    <section className="home-sections" aria-labelledby="home-sections-title">
      <div className="home-section-heading"><h2 id="home-sections-title">{t('和它有关的小事', 'The little things that matter', '和牠有關的小事')}</h2></div>
      <div className="journey-grid">
        {sections.map(section => <article className="journey-card" key={section.to}>
          <Link to={section.to} className="journey-image" tabIndex={-1} aria-hidden="true"><img src={section.image} alt="" loading="lazy" /></Link>
          <div className="journey-copy"><h3>{section.title}</h3><p>{section.text}</p><Link className="text-link" to={section.to}>{section.action}</Link></div>
        </article>)}
      </div>
    </section>
  </main>;
}
