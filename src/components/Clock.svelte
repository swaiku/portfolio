<script lang="ts">
  import { onMount } from 'svelte';

  let { tz = 'Europe/Zurich' }: { tz?: string } = $props();
  let now = $state('--:--:--');

  onMount(() => {
    const f = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
    const tick = () => (now = f.format(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  });
</script>

<time class="tabular-nums">{now}</time>
