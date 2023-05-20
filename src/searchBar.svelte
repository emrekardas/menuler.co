<script>
    import { createEventDispatcher } from 'svelte';
  
    const dispatch = createEventDispatcher();
    let searchQuery = '';
  
    function handleSearch() {
      dispatch('search', searchQuery);
    }
  </script>
  
  <div>
    <input type="text" bind:value={searchQuery} placeholder="Mekan ara..." on:input={handleSearch} />
  </div>
  
  <style>
    div {
      margin-bottom: 1rem;
    }
  </style>
  