<script>
  import data from './data/data.json';

  export let selectedCategory = '';
  export let onCategoryFilter = () => {};

  const categories = Array.from(new Set(data.data.map(mekan => mekan.kategori)));

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
      class:selected={selectedCategory === category}
      on:click={() => handleCategoryFilter(category)}
    >
      <img src={`./icons/${category}.svg`} alt={category} />
    </button>
  {/each}
</div>

<style>
  .selected {
    font-weight: bold;
  }
</style>
