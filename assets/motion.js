document.documentElement.classList.add("motion-ready");
const revealObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add("visible");revealObserver.unobserve(entry.target)}}),{threshold:.12});
document.querySelectorAll(".reveal").forEach(el=>revealObserver.observe(el));
const weaveObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(!entry.isIntersecting)return;entry.target.classList.add("is-active");setTimeout(()=>entry.target.classList.remove("is-active"),1300);weaveObserver.unobserve(entry.target)}),{threshold:.42});
document.querySelectorAll(".teaser").forEach((el,i)=>setTimeout(()=>weaveObserver.observe(el),i*160));
const spine=document.querySelector(".spine-line");if(spine){spine.style.transform="scaleY(0)";requestAnimationFrame(()=>setTimeout(()=>spine.style.transform="scaleY(1)",180))}
