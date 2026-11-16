import {useState} from 'react';
export default function SpotifyLinks(){
 const [query,setQuery]=useState('');
 return <section className="external-search" aria-label="Spotify search"><span className="eyebrow">BEYOND YOUR COLLECTION</span><h2>Find it on Spotify.</h2><p>Search songs, albums, and artists on Spotify. Your local recordings stay playable here.</p><form action={`https://open.spotify.com/search/${encodeURIComponent(query.trim())}`} target="_blank" rel="noopener noreferrer" onSubmit={e=>{if(!query.trim())e.preventDefault();}}><input aria-label="Search Spotify" placeholder="A song, an artist, a feeling…" value={query} onChange={e=>setQuery(e.target.value)} maxLength={200} required/><button className="button primary" disabled={!query.trim()}>Search on Spotify ↗</button></form><small>Opens Spotify in a new tab. Spotify is not connected to MusicStruct; songs are not imported, downloaded, or analysed.</small></section>;
}
