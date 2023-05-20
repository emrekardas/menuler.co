<script>
    export let selectedCategory = '';
    export let onCategoryFilter = () => {};
    import { onMount } from 'svelte';
  
    const categories = [
      { name: 'burger', icon: 'fa-burger' },
      { name: 'kahvaltı', icon: 'fa-pancakes' },
      { name: 'kebap', icon: 'fa-shish-kebab' },
      { name: 'içki', icon: 'fa-wine-glass' }
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
        <i class="fa-solid {category.icon}"></i>
      </button>
    {/each}
  </div>
  
  <style>
    .active {
      font-weight: bold;
    }
  </style>
  