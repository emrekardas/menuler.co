<script>
  export let selectedCategory = '';
  export let onCategoryFilter = () => {};

  const categories = [
    { name: 'burger', src: './icons/burger.svg' },
    { name: 'kahvaltı', src: './icons/pancake.svg' },
    { name: 'kebap', src: './icons/kebab.svg' },
    { name: 'içki', src: './icons/wine-glass.svg' }
  ];

  function handleCategoryFilter(category) {
    if (selectedCategory === category) {
      selectedCategory = '';
    } else {
      selectedCategory = category;
      console.log(selectedCategory, 'seçildi');
    }
    onCategoryFilter(selectedCategory);
  }
</script>

<div>
  {#each categories as category}
    <button
      class:selected={selectedCategory === category.name}
      on:click={() => handleCategoryFilter(category.name)}
    >
      <img src={category.src} alt={category.name} />
    </button>
  {/each}
</div>

<style>
  .active {
    font-weight: bold;
  }
</style>
