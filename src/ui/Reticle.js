export class Reticle {
  constructor() {
    this.el = document.getElementById('reticle');
    this.lastX = 0.5;
    this.lastY = 0.5;
  }

  setNDC(ndc) {
    if (!ndc) return;
    const x = (ndc.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-ndc.y * 0.5 + 0.5) * window.innerHeight;
    this.lastX = x;
    this.lastY = y;
    this.el.style.transform = `translate(${x}px, ${y}px)`;
  }

  flash() {
    this.el.classList.add('firing');
    setTimeout(() => this.el.classList.remove('firing'), 60);
  }

  setHidden(hidden) {
    this.el.style.opacity = hidden ? 0 : 0.9;
  }
}
