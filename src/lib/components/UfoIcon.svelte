<script>
  let { size = 34, class: className = '' } = $props();
</script>

<svg
  class="ufo-icon {className}"
  width={size}
  height={size}
  viewBox="0 0 48 48"
  fill="none"
  aria-hidden="true"
>
  <path class="beam" d="M18 28.5 13.4 41h21.2L30 28.5Z" />
  <path class="dome" d="M17.4 21.7c0-5.9 2.9-10.1 6.6-10.1s6.6 4.2 6.6 10.1" />
  <ellipse class="saucer" cx="24" cy="24.4" rx="17.2" ry="5.6" />
  <path class="rim" d="M11.9 24.9c2.4 1.9 6.7 3.1 12.1 3.1s9.7-1.2 12.1-3.1" />
  <circle class="light" cx="12.5" cy="24.2" r="1.15" />
  <circle class="light" cx="19" cy="26.1" r="1.15" />
  <circle class="light" cx="29" cy="26.1" r="1.15" />
  <circle class="light" cx="35.5" cy="24.2" r="1.15" />
  <circle class="alien" cx="21.4" cy="17.6" r="1.15" />
  <circle class="alien" cx="26.6" cy="17.6" r="1.15" />
</svg>

<style>
  .ufo-icon {
    display: block;
    color: currentColor;
    overflow: visible;
  }
  .saucer {
    fill: rgba(255, 255, 255, 0.08);
    stroke: currentColor;
    stroke-width: 2;
  }
  .dome {
    fill: rgba(125, 255, 210, 0.1);
    stroke: currentColor;
    stroke-width: 1.8;
  }
  .rim {
    stroke: currentColor;
    stroke-width: 1.2;
    opacity: 0.55;
    fill: none;
  }
  .beam {
    fill: rgba(255, 95, 216, 0.2);
    stroke: rgba(255, 130, 230, 0.85);
    stroke-width: 1.1;
    stroke-dasharray: 2.5 2;
  }
  .light {
    fill: #ff7be0;
    filter: drop-shadow(0 0 3px #ff5fd8);
  }
  .alien {
    fill: #8affc8;
  }
</style>
