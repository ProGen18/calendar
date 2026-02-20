import React, { useState, useEffect, useMemo } from 'react';

// Local icons since we don't have access to App's Icons directly unless exported
const Icons = {
    Search: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
    MapPin: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>,
    Star: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
    StarFilled: () => <svg viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
    AlertCircle: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>,
    ChevronDown: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>,
    ChevronUp: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>,
    X: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
};

function formatMenuDate(dateString) {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function PinnedMenu({ resto, onUnpin }) {
    const [menus, setMenus] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        if (!isExpanded) return;
        if (menus.length > 0) return; // already loaded

        setLoading(true);
        fetch(`https://api.croustillant.menu/v1/restaurants/${resto.code}/menu`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setMenus(data.data || []);
                } else {
                    setError("Impossible de charger le menu.");
                }
            })
            .catch(() => setError("Erreur de connexion."))
            .finally(() => setLoading(false));
    }, [resto.code, isExpanded]);

    const renderMeal = (meal, typeName) => {
        if (!meal || !meal.categories || meal.categories.length === 0) return null;
        return (
            <div className="resto-meal">
                <h5 className="resto-meal__title">{typeName}</h5>
                <div className="resto-meal__items">
                    {meal.categories.map((category, idx) => (
                        <div key={idx} className="resto-meal__category">
                            <span className="resto-meal__category-name">{category.libelle}</span>
                            <ul className="resto-meal__food-list">
                                {category.plats.map((item, idxf) => (
                                    <li key={idxf}>{item.libelle}</li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="resto-card resto-card--pinned">
            <div className="resto-card__header" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="resto-card__info">
                    <h3 className="resto-card__title">{resto.nom}</h3>
                    <div className="resto-card__zone"><Icons.MapPin /> {resto.zone || resto.adresse}</div>
                </div>
                <div className="resto-card__actions">
                    <button
                        className="btn btn--icon btn--ghost"
                        onClick={(e) => { e.stopPropagation(); onUnpin(resto); }}
                        title="Désépingler"
                    >
                        <Icons.StarFilled />
                    </button>
                    <button className="btn btn--icon btn--ghost">
                        {isExpanded ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
                    </button>
                </div>
            </div>
            {isExpanded && (
                <div className="resto-card__content">
                    {loading ? (
                        <div className="loading"><div className="loading__spinner" /></div>
                    ) : error ? (
                        <div className="resto-empty">{error}</div>
                    ) : menus.length === 0 ? (
                        <div className="resto-empty">Aucun menu disponible.</div>
                    ) : (
                        <div className="resto-menus">
                            {menus.map((dayMenu, i) => {
                                const midi = dayMenu.repas.find(r => r.type === 'midi');
                                const soir = dayMenu.repas.find(r => r.type === 'soir');

                                const midiStr = midi ? renderMeal(midi, "Midi") : null;
                                const soirStr = soir ? renderMeal(soir, "Soir") : null;
                                if (!midiStr && !soirStr) return null;

                                return (
                                    <div key={i} className="resto-day">
                                        <h4 className="resto-day__date">{formatMenuDate(dayMenu.date)}</h4>
                                        <div className="resto-day__meals">
                                            {midiStr}
                                            {soirStr}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function RestoUView() {
    const [restaurants, setRestaurants] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pinnedIds, setPinnedIds] = useState(() => {
        try {
            const saved = localStorage.getItem('celcat-resto-pinned');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });

    useEffect(() => {
        fetch('https://api.croustillant.menu/v1/restaurants')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setRestaurants(data.data);
                } else {
                    setError("Impossible de charger les restaurants.");
                }
            })
            .catch(() => setError("Erreur de connexion."))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        localStorage.setItem('celcat-resto-pinned', JSON.stringify(pinnedIds));
    }, [pinnedIds]);

    const togglePin = (resto) => {
        setPinnedIds(prev => {
            if (prev.includes(resto.code)) return prev.filter(id => id !== resto.code);
            return [...prev, resto.code];
        });
    };

    const pinnedRestos = useMemo(() => {
        return pinnedIds.map(id => restaurants.find(r => r.code === id)).filter(Boolean);
    }, [pinnedIds, restaurants]);

    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const q = searchQuery.toLowerCase();
        return restaurants.filter(r => {
            const searchable = [r.nom, r.adresse, r.zone, r.type?.libelle].filter(Boolean).join(' ').toLowerCase();
            return searchable.includes(q) && !pinnedIds.includes(r.code);
        }).slice(0, 15);
    }, [restaurants, searchQuery, pinnedIds]);

    if (loading) return <div className="loading"><div className="loading__spinner" /><p>Chargement des restaurants...</p></div>;
    if (error) return <div className="empty-state"><div className="empty-state__icon"><Icons.AlertCircle /></div><h3 className="empty-state__title">Erreur</h3><p>{error}</p></div>;

    return (
        <div className="resto-view">
            {pinnedRestos.length > 0 && (
                <div className="resto-section resto-section--pinned">
                    <h3 className="resto-section__title"><Icons.StarFilled /> Restaurants Épinglés</h3>
                    <div className="resto-list">
                        {pinnedRestos.map(resto => (
                            <PinnedMenu key={resto.code} resto={resto} onUnpin={togglePin} />
                        ))}
                    </div>
                </div>
            )}

            <div className="resto-section">
                <h3 className="resto-section__title"><Icons.Search /> Rechercher un restaurant</h3>
                <div className="tools-search">
                    <input
                        type="text"
                        className="tools-search__input"
                        placeholder="Nom, ville, campus..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button className="tools-search__clear" onClick={() => setSearchQuery('')}>
                            <Icons.X />
                        </button>
                    )}
                </div>

                {searchQuery && (
                    <div className="resto-list" style={{ marginTop: '1rem' }}>
                        {searchResults.length === 0 ? (
                            <p className="resto-empty">Aucun restaurant trouvé</p>
                        ) : (
                            searchResults.map(resto => (
                                <div key={resto.code} className="resto-card">
                                    <div className="resto-card__header">
                                        <div className="resto-card__info">
                                            <h3 className="resto-card__title">{resto.nom}</h3>
                                            <div className="resto-card__zone"><Icons.MapPin /> {resto.zone || resto.adresse}</div>
                                        </div>
                                        <div className="resto-card__actions">
                                            <button
                                                className="btn btn--icon btn--ghost"
                                                onClick={() => togglePin(resto)}
                                                title="Épingler"
                                            >
                                                <Icons.Star />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
