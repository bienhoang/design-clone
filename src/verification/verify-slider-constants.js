/**
 * Slider Verification Constants
 *
 * CSS selector patterns for known slider libraries and autoplay detection config.
 * Extracted from verify-slider-helpers.js to keep each file under 200 lines.
 */

// Slider library CSS selector patterns
export const SLIDER_PATTERNS = {
  swiper: {
    container: '[class*="swiper"]',
    slide: '.swiper-slide',
    active: '.swiper-slide-active',
    prev: '.swiper-button-prev',
    next: '.swiper-button-next',
    pagination: '.swiper-pagination'
  },
  slick: {
    container: '[class*="slick"]',
    slide: '.slick-slide',
    active: '.slick-active, .slick-current',
    prev: '.slick-prev',
    next: '.slick-next',
    pagination: '.slick-dots'
  },
  owl: {
    container: '[class*="owl"]',
    slide: '.owl-item',
    active: '.owl-item.active',
    prev: '.owl-prev',
    next: '.owl-next',
    pagination: '.owl-dots'
  },
  splide: {
    container: '.splide',
    slide: '.splide__slide',
    active: '.splide__slide.is-active',
    prev: '.splide__arrow--prev',
    next: '.splide__arrow--next',
    pagination: '.splide__pagination'
  },
  glide: {
    container: '.glide',
    slide: '.glide__slide',
    active: '.glide__slide--active',
    prev: '[data-glide-dir="<"]',
    next: '[data-glide-dir=">"]',
    pagination: '.glide__bullets'
  },
  native: {
    container: '[style*="scroll-snap"], [class*="carousel"], [class*="slider"]',
    slide: '[style*="scroll-snap"] > *, .carousel-item, .slider-item',
    active: '.active, [aria-current="true"]',
    prev: '[class*="prev"], [aria-label*="prev" i]',
    next: '[class*="next"], [aria-label*="next" i]',
    pagination: '[class*="indicator"], [class*="dot"], [role="tablist"]'
  }
};

// Autoplay detection config
export const AUTOPLAY_CONFIG = {
  waitTime: 6000,        // Total wait time in ms
  checkInterval: 1000,   // Check every 1s
  requiredChanges: 2     // Require 2 slide changes (per validation)
};
