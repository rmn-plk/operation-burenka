<script>
  let { active = false, size = 18, class: className = '' } = $props();
</script>

<svg
  class="cow-icon {active ? 'is-active' : ''} {className}"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  aria-hidden="true"
>
  <path class="cow-ear" d="M6.1 8.2 3.4 9.7c-.7.4-.8 1.4-.2 2l1.9 1.8" />
  <path class="cow-ear" d="M17.9 8.2l2.7 1.5c.7.4.8 1.4.2 2l-1.9 1.8" />
  <path class="cow-horn" d="M7.2 7.2 5.7 4.5M16.8 7.2l1.5-2.7" />
  <path class="cow-head" d="M6.8 8.1h10.4c1.4 0 2.5 1.1 2.5 2.5v5.1c0 2.4-2 4.4-4.4 4.4H8.7c-2.4 0-4.4-2-4.4-4.4v-5.1c0-1.4 1.1-2.5 2.5-2.5Z" />
  <path class="cow-snout" d="M9 13.8h6v3.4c0 .8-.7 1.5-1.5 1.5h-3c-.8 0-1.5-.7-1.5-1.5v-3.4Z" />
  <circle class="cow-eye" cx="8.8" cy="11.4" r="0.9" />
  <circle class="cow-eye" cx="15.2" cy="11.4" r="0.9" />
  <path class="cow-nostril" d="M10.3 15.4h.7M13 15.4h.7" />
  <path class="cow-tuft" d="M9.3 7.9c.6-1.1 1.5-1.7 2.7-1.7s2.1.6 2.7 1.7" />
</svg>

<style>
  .cow-icon {
    display: block;
    color: rgba(244, 236, 216, 0.38);
    transition: color 180ms ease, transform 180ms ease, filter 180ms ease;
    overflow: visible;
  }
  .cow-head {
    fill: transparent;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linejoin: round;
    transition: fill 180ms ease;
  }
  .cow-ear,
  .cow-horn,
  .cow-tuft,
  .cow-nostril {
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
    fill: none;
  }
  .cow-snout {
    fill: transparent;
    stroke: currentColor;
    stroke-width: 1.4;
    stroke-linejoin: round;
  }
  .cow-eye {
    fill: currentColor;
  }
  .cow-icon.is-active {
    color: #ff7be0;
    filter: drop-shadow(0 0 6px rgba(255, 95, 216, 0.55));
    transform: translateY(-1px);
  }
  .cow-icon.is-active .cow-head {
    fill: currentColor;
  }
  .cow-icon.is-active .cow-snout {
    fill: rgba(20, 10, 28, 0.28);
    stroke: #1a0e26;
  }
  .cow-icon.is-active .cow-eye {
    fill: #1a0e26;
  }
  .cow-icon.is-active .cow-ear,
  .cow-icon.is-active .cow-horn,
  .cow-icon.is-active .cow-tuft,
  .cow-icon.is-active .cow-nostril {
    stroke: #ffc8f2;
  }
</style>
