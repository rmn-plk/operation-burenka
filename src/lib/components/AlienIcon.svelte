<script>
  let { size = 34, class: className = '' } = $props();
</script>

<svg
  class="alien-icon {className}"
  width={size}
  height={size}
  viewBox="0 0 48 48"
  fill="none"
  aria-hidden="true"
>
  <path class="neck" d="M20 36h8v5h-8z" />
  <path class="shoulders" d="M14.5 46c.6-4.2 4-6.2 9.5-6.2s8.9 2 9.5 6.2" />
  <path class="head" d="M24 4.5c8.7 0 14.6 7 14.6 16.1 0 9.4-6 16.4-14.6 16.4S9.4 30 9.4 20.6C9.4 11.5 15.3 4.5 24 4.5Z" />
  <ellipse class="eye" cx="18.4" cy="20.4" rx="3.5" ry="5.6" transform="rotate(-16 18.4 20.4)" />
  <ellipse class="eye" cx="29.6" cy="20.4" rx="3.5" ry="5.6" transform="rotate(16 29.6 20.4)" />
  <ellipse class="glint" cx="17.3" cy="18.2" rx="1" ry="1.7" transform="rotate(-16 17.3 18.2)" />
  <ellipse class="glint small" cx="28.7" cy="18.4" rx="0.65" ry="1.1" transform="rotate(16 28.7 18.4)" />
  <path class="mouth" d="M21.4 30.2c1.7 1 3.5 1 5.2 0" />
</svg>

<style>
  .alien-icon {
    display: block;
    overflow: visible;
  }
  .head {
    fill: rgba(168, 195, 154, 0.2);
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linejoin: round;
  }
  .neck,
  .shoulders {
    fill: rgba(168, 195, 154, 0.08);
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linejoin: round;
  }
  .eye {
    fill: #08090e;
    stroke: rgba(255, 255, 255, 0.2);
    stroke-width: 0.55;
  }
  .glint {
    fill: #fff;
    opacity: 0.9;
  }
  .glint.small {
    opacity: 0.6;
  }
  .mouth {
    stroke: currentColor;
    stroke-width: 1.2;
    stroke-linecap: round;
    opacity: 0.65;
  }
</style>