'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './DrinksManager.module.css';
import { toggleDrinkActive } from './drink-actions';

export interface SerializedDrink {
  id: number;
  name: string;
  category: {
    id: number;
    name: string;
    slug?: string;
  } | null;
  image: {
    id: number;
    url?: string;
    alt?: string;
  } | null;
  description?: string | null;
  active: boolean;
  updatedAt: string;
  createdAt: string;
}

export interface SerializedCategory {
  id: number;
  name: string;
}

interface DrinksManagerProps {
  initialDrinks: SerializedDrink[];
  categories: SerializedCategory[];
}

export function DrinksManager({ initialDrinks, categories }: DrinksManagerProps) {
  const [drinks, setDrinks] = useState<SerializedDrink[]>(initialDrinks);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // Filtered Drinks
  const filteredDrinks = useMemo(() => {
    return drinks.filter((d) => {
      // Search filter
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const matchesName = d.name.toLowerCase().includes(query);
        const matchesCat = d.category?.name.toLowerCase().includes(query);
        if (!matchesName && !matchesCat) return false;
      }

      // Category filter
      if (selectedCategory !== 'ALL') {
        if (!d.category || d.category.id !== selectedCategory) return false;
      }

      // Status filter
      if (statusFilter === 'ACTIVE' && !d.active) return false;
      if (statusFilter === 'INACTIVE' && d.active) return false;

      return true;
    });
  }, [drinks, search, selectedCategory, statusFilter]);

  // Active counts
  const totalActive = useMemo(() => drinks.filter((d) => d.active).length, [drinks]);

  // Handle status toggle
  const handleToggleActive = async (drink: SerializedDrink) => {
    if (togglingId) return;
    const newStatus = !drink.active;

    // Optimistic UI update
    setTogglingId(drink.id);
    setDrinks((prev) =>
      prev.map((d) => (d.id === drink.id ? { ...d, active: newStatus } : d))
    );

    try {
      const res = await toggleDrinkActive(drink.id, newStatus);
      if (!res.success) {
        // Rollback on failure
        setDrinks((prev) =>
          prev.map((d) => (d.id === drink.id ? { ...d, active: !newStatus } : d))
        );
        alert(res.error || 'مقدرناش نغيّر حالة المشروب دلوقتي، جرّب تاني');
      }
    } catch {
      // Rollback
      setDrinks((prev) =>
        prev.map((d) => (d.id === drink.id ? { ...d, active: !newStatus } : d))
      );
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className={styles.container}>
      {/* ── Header Ribbon ──────────────────────────────────────────────── */}
      <div className={styles.headerCard}>
        <div className={styles.headerWave} />
        <div className={styles.headerContent}>
          <div className={styles.headerBadge}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            PROMOTIONAL DRINKS CATALOG / منيو مشروبات الجوائز
          </div>
          <h1 className={styles.headerTitle}>
            Drinks Menu Manager <span style={{ fontSize: '1.15rem', fontWeight: 600, opacity: 0.85 }}>/ إدارة أصناف المشروبات</span>
          </h1>
          <p className={styles.headerSubtitle}>
            تحكم في المشروبات المتاحة والموقوفة في الهدايا بضغطة زرار واحدة ومن غير تعقيد
          </p>
        </div>

        <div className={styles.headerActions}>
          <Link href="/admin/collections/drinks/create" className={styles.createButton}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            + New Drink / صنف جديد
          </Link>
        </div>
      </div>

      {/* ── Filters Card ───────────────────────────────────────────────── */}
      <div className={styles.filterCard}>
        <div className={styles.filterTopRow}>
          {/* Search Input */}
          <div className={styles.searchBox}>
            <svg width="16" height="16" className={styles.searchIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search drink name or category... / دوّر باسم المشروب أو الصنف"
              className={styles.searchInput}
            />
          </div>

          {/* Stats & Status Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div className={styles.statsPill}>
              <span>Total: {drinks.length}</span>
              <span style={{ color: '#059669' }}>• Available: {totalActive}</span>
              {drinks.length - totalActive > 0 && (
                <span style={{ color: '#DC2626' }}>• Out of Stock: {drinks.length - totalActive}</span>
              )}
            </div>

            <div className={styles.statusFilterGroup}>
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`${styles.statusFilterBtn} ${statusFilter === 'ALL' ? styles.statusFilterBtnActive : ''}`}
              >
                All / كل الأصناف
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('ACTIVE')}
                className={`${styles.statusFilterBtn} ${statusFilter === 'ACTIVE' ? styles.statusFilterBtnActive : ''}`}
              >
                Available / المتاح بس
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('INACTIVE')}
                className={`${styles.statusFilterBtn} ${statusFilter === 'INACTIVE' ? styles.statusFilterBtnActive : ''}`}
              >
                Out of Stock / الموقوف دلوقتي
              </button>
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div className={styles.categoriesRow}>
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={`${styles.categoryTab} ${selectedCategory === 'ALL' ? styles.categoryTabActive : ''}`}
          >
            All Categories ({drinks.length}) / كل الأقسام
          </button>
          {categories.map((cat) => {
            const count = drinks.filter((d) => d.category?.id === cat.id).length;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`${styles.categoryTab} ${selectedCategory === cat.id ? styles.categoryTabActive : ''}`}
              >
                {cat.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Compact Cards Grid ─────────────────────────────────────────── */}
      {filteredDrinks.length === 0 ? (
        <div className={styles.emptyState}>
          <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className={styles.emptyTitle}>No beverages matching search / ملقيناش مشروبات بالاسم ده</p>
          <p className={styles.emptySubtitle}>Try changing category filter or clearing search box / جرب تمسح البحث أو تختار قسم تاني</p>
        </div>
      ) : (
        <div className={styles.drinksGrid}>
          {filteredDrinks.map((drink) => {
            const isToggling = togglingId === drink.id;

            return (
              <div
                key={drink.id}
                className={`${styles.drinkCard} ${!drink.active ? styles.drinkCardDisabled : ''}`}
              >
                {/* 1. Optimized Thumbnail */}
                <div className={styles.thumbnailWrapper}>
                  {drink.image?.url ? (
                    <Image
                      src={drink.image.url}
                      alt={drink.image.alt || drink.name}
                      width={68}
                      height={68}
                      loading="lazy"
                      className={styles.thumbnailImg}
                    />
                  ) : (
                    <div className={styles.thumbnailFallback}>
                      <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
                        <line x1="6" y1="2" x2="6" y2="4" strokeLinecap="round" />
                        <line x1="10" y1="2" x2="10" y2="4" strokeLinecap="round" />
                        <line x1="14" y1="2" x2="14" y2="4" strokeLinecap="round" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* 2. Drink Details */}
                <div className={styles.drinkInfo}>
                  <div className={styles.nameRow}>
                    <h3 className={styles.drinkName} title={drink.name}>
                      {drink.name}
                    </h3>
                  </div>

                  {drink.category?.name && (
                    <div>
                      <span className={styles.categoryPill}>
                        {drink.category.name}
                      </span>
                    </div>
                  )}

                  {drink.description ? (
                    <p className={styles.drinkDescription} title={drink.description}>
                      {drink.description}
                    </p>
                  ) : (
                    <p className={styles.drinkDescription} style={{ fontStyle: 'italic', color: '#94A3B8' }}>
                      No description snippet / ملوش وصف لسه
                    </p>
                  )}
                </div>

                {/* 3. Actions Column */}
                <div className={styles.drinkActions}>
                  {/* Status Toggle Switch */}
                  <button
                    type="button"
                    disabled={isToggling}
                    onClick={() => handleToggleActive(drink)}
                    className={styles.toggleSwitch}
                    title={drink.active ? 'Available in stock (click to disable) / متاح وشغال' : 'Out of stock (click to activate) / متوقف'}
                  >
                    <div className={`${styles.toggleTrack} ${drink.active ? styles.toggleTrackActive : ''}`}>
                      <div className={`${styles.toggleThumb} ${drink.active ? styles.toggleThumbActive : ''}`} />
                    </div>
                    <span className={`${styles.statusText} ${drink.active ? styles.statusTextActive : ''}`}>
                      {drink.active ? 'In Stock / متاح' : 'Out / موقوف'}
                    </span>
                  </button>

                  {/* Edit Link */}
                  <Link
                    href={`/admin/collections/drinks/${drink.id}`}
                    className={styles.editButton}
                    title="Edit drink details in Payload / تعديل الصنف"
                  >
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit / تعديل الصنف
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
