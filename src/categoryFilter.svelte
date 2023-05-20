<script>
    export let selectedCategory = '';
    export let onCategoryFilter = () => {};
    import { onMount } from 'svelte';
  
    const categories = [
      { name: 'burger', src: './icons/burger.svg' },
      { name: 'kahvaltı', src: './icons/pancake.svg' },
      { name: 'kebap', sr: './icons/kebab.svg' },
      { name: 'içki', src: './icons/wine-glass.svg' }
    ];
  
    function handleCategoryFilter(category) {
      selectedCategory = category;
      onCategoryFilter(category);
    }
  </script>
  
  <div>
    {#each categories as category}
      <button
        class={selectedCategory === category.name ? 'active' : ''}
        on:click={() => handleCategoryFilter(category.name)}
      >
        <i class="{category.name}" src="{category.src}"></i>
      </button>
    {/each}
  </div>
  
  <style>
    .active {
      font-weight: bold;
    }
  </style>
  