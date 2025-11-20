/**
 * Dynamicky načte klíčová slova ze souboru keywords.txt a vloží je do meta tagu.
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Cesta k souboru je relativní k HTML souboru, který tento skript volá.
        const response = await fetch('./keywords.txt');
        if (!response.ok) {
            throw new Error(`Chyba při načítání souboru: ${response.statusText}`);
        }
        const text = await response.text();

        // Zpracování textu: rozdělí podle řádků, odstraní prázdné řádky a spojí čárkou.
        const keywords = text.split('\n').filter(k => k.trim() !== '').join(', ');

        // Najde meta tag a vloží do něj obsah.
        const metaKeywords = document.querySelector('meta[name="keywords"]');
        if (metaKeywords) {
            metaKeywords.content = keywords;
        }
    } catch (error) {
        console.error('Nepodařilo se načíst klíčová slova:', error);
    }
});