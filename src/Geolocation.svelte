<script>
    import { onMount } from 'svelte';
  
    function handleGeolocationPermission() {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(handleGeolocationSuccess, handleGeolocationError);
      } else {
        console.log("Tarayıcınızda konum hizmetleri desteklenmiyor.");
      }
    }
  
    function handleGeolocationSuccess(position) {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
  
      // İl bilgisini almak için konum verilerini kullanabilirsiniz
      // Bu örnekte, OpenCage Geocoding API kullanarak il bilgisini alıyoruz
      const apiKey = "be437a385f5e439c9f1da91c99a750f0"; // API anahtarınızı buraya yerleştirin
      const apiUrl = `https://api.opencagedata.com/geocode/v1/json?key=${apiKey}&q=${latitude},${longitude}&pretty=1`;
  
      fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
          const city = data.results[0].components.state;
          console.log("Konumun il bilgisi:", city);
        })
        .catch(error => {
          console.log("İl bilgisi alınırken bir hata oluştu:", error);
        });
    }
  
    function handleGeolocationError(error) {
      console.log("Konum bilgisi alınamadı:", error.message);
    }
  
    onMount(handleGeolocationPermission);
  </script>
  