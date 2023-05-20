<script>
    import { onMount } from 'svelte';
    import { createEventDispatcher } from 'svelte';
  
    const dispatch = createEventDispatcher();
    let iller = [];
  
    async function fetchIller() {
      const apiKey = 'be437a385f5e439c9f1da91c99a750f0'; // Opencage API anahtarınızı buraya girin
      const response = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=turkey&countrycode=tr&limit=500&key=${apiKey}`);
      const data = await response.json();
      iller = data.results
        .filter(result => result.components.city || result.components.town) // Şehir veya kasaba bileşeni olan sonuçları filtrele
        .map(result => result.components.city || result.components.town); // Şehir veya kasaba bileşenini al
    }
  
    onMount(fetchIller);
  
    function handleSubmit() {
      // Form verilerini işleme devam et
    }
  </script>
  
  <form on:submit|preventDefault={handleSubmit}>
    <div>
      <label for="mekanIsmi">Mekan İsmi:</label>
      <input type="text" id="mekanIsmi" required />
    </div>
    <div>
      <label for="il">İl:</label>
      <select id="il" required>
        <option value="">İl Seçiniz</option>
        {#each iller as il}
          <option value={il}>{il}</option>
        {/each}
      </select>
    </div>
    <div>
      <label for="qrLink">Menü QR Linki:</label>
      <input type="text" id="qrLink" />
    </div>
    <button type="submit">Gönder</button>
  </form>
  