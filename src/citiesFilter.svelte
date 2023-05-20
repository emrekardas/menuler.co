<script>
    import data from './data/data.json';
    import { createEventDispatcher } from 'svelte';
  
    const dispatch = createEventDispatcher();
    let cities = Array.from(new Set(data.data.map(item => item.şehir)));
  
    function handleCityFilter(city) {
      dispatch('cityFilter', city);
    }
  </script>
  
  <div>
    <select on:change={event => handleCityFilter(event.target.value)}>
      <option value="">Tüm Şehirler</option>
      {#each cities as city}
        <option value={city}>{city}</option>
      {/each}
    </select>
  </div>
  
  <style>
    div {
      margin-bottom: 1rem;
    }
  </style>
  