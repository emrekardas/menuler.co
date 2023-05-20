<script>
	import RestaurantList from './restaurantList.svelte';
	import Geolocation from './Geolocation.svelte';
	import Form from './form.svelte'
  </script>
  
  <main>
	<h1>Menüler</h1>
	<RestaurantList />
	<Form />
	<Geolocation />
  </main>
  
  <style>
	h1 {
	  text-align: center;
	}
  </style>
  