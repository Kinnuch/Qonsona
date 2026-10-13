<script lang="ts">
  import type { AccountCharacter } from '$shared/account'
  import dawn from '../../assets/collection/companions-dawn.png'
  import journey from '../../assets/collection/companions-journey.png'
  import twilight from '../../assets/collection/companions-twilight.png'

  let {
    character,
    sheet = 0,
    cell = 0,
    rect,
    width = 126,
    locked = false
  }: {
    character?: AccountCharacter
    sheet?: number
    cell?: number
    rect?: [number, number, number, number]
    width?: number
    locked?: boolean
  } = $props()
  const sheets = [dawn, journey, twilight]
  const dimensions = [
    [126, 78],
    [126, 78],
    [393, 160]
  ]
  const source = $derived(character?.sheet ?? sheet)
  const crop = $derived(
    rect ??
      (character?.sprite
        ? [character.sprite.x, character.sprite.y, character.sprite.width, character.sprite.height]
        : [
            ((character?.cell ?? cell) % 3) * 42,
            Math.floor((character?.cell ?? cell) / 3) * 39,
            42,
            39
          ])
  )
  const sourceWidth = $derived(character?.sprite?.sheetWidth ?? dimensions[source]?.[0] ?? 126)
  const sourceHeight = $derived(character?.sprite?.sheetHeight ?? dimensions[source]?.[1] ?? 78)
</script>

<span
  class="sprite"
  class:locked
  data-companion-sprite={character?.id}
  aria-hidden="true"
  style:width={`${width}px`}
  style:aspect-ratio={`${crop[2]} / ${crop[3]}`}
>
  <img
    src={sheets[source] ?? sheets[0]}
    alt=""
    draggable="false"
    style:width={`${(sourceWidth / crop[2]) * 100}%`}
    style:height={`${(sourceHeight / crop[3]) * 100}%`}
    style:left={`${(-crop[0] / crop[2]) * 100}%`}
    style:top={`${(-crop[1] / crop[3]) * 100}%`}
  />
</span>

<style>
  .sprite {
    display: inline-block;
    position: relative;
    overflow: hidden;
    flex-shrink: 0;
    max-width: 100%;
    vertical-align: middle;
    pointer-events: none;
  }
  img {
    position: absolute;
    max-width: none;
    image-rendering: pixelated;
    user-select: none;
  }
  .locked {
    filter: grayscale(1);
    opacity: 0.32;
  }
</style>
