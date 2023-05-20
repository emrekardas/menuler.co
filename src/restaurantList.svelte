<script>
    import data from './data/data.json';
    import SearchBar from './searchBar.svelte';
    import CitiesFilter from './citiesFilter.svelte';
    import { onMount } from 'svelte';
    import CategoryFilter from './categoryFilter.svelte';
  
    let mekanlar = data.data;
    let filteredMekanlar = mekanlar;
    let selectedCity = '';
    let selectedCategory = '';
    let searchQuery = '';

  
    function handleSearch(event) {
      searchQuery = event.detail.toLowerCase();
      applyCityFilter();
    }
    
    function handleCategoryFilter(event) {
        selectedCategory = event.detail;
    }

    function handleCityFilter(event) {
      selectedCity = event.detail;
      applyCityFilter();
    }
  
    function applyCityFilter() {
      if (selectedCity) {
        filteredMekanlar = mekanlar.filter(mekan =>
          mekan.şehir === selectedCity && mekan['mekan-ismi'].toLowerCase().startsWith(searchQuery)
        );
        console.log(selectedCity, 'seçildi');
      } else {
        filteredMekanlar = mekanlar.filter(mekan =>
          mekan['mekan-ismi'].toLowerCase().startsWith(searchQuery)
        );
        console.log('Hiçbir şehir seçilmedi');
      }
    }



  
    onMount(() => {
      applyCityFilter();
    });
  </script>
  
  <main>
    <h1>Restoran Listesi</h1>
    <SearchBar on:search={handleSearch} />
    <CitiesFilter on:cityFilter={handleCityFilter} selectedCity={selectedCity} />
    <CategoryFilter bind:selectedCategory on:categoryFilter={handleCategoryFilter} />

  
    <ul>
        {#each filteredMekanlar as mekan}
          {#if (!selectedCity || mekan.şehir === selectedCity) && (!selectedCategory || mekan.kategori === selectedCategory)}
            <li>{mekan['mekan-ismi']}</li>
          {/if}
        {/each}
      </ul>
  </main>
  
  <style>
    ul {
      list-style-type: none;
      padding: 0;
    }
  
    li {
      margin-bottom: 0.5rem;
    }
  </style>
  