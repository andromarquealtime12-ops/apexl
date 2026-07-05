import { describe, it, expect } from "vitest";
import { calculateFee, type DeliveryZone } from "./deliveryPricing";

const santoDomingo: DeliveryZone = {
  id: "sd",
  name: "Santo Domingo",
  country: "DO",
  city: "Santo Domingo",
  center_lat: 18.4861,
  center_lng: -69.9312,
  radius_km: 25,
  base_fee: 50,
  fee_per_km: 30,
  currency: "DOP",
  active: true,
};

const santiago: DeliveryZone = {
  ...santoDomingo,
  id: "st",
  name: "Santiago",
  city: "Santiago",
  radius_km: 20,
};

const portAuPrince: DeliveryZone = {
  id: "pap",
  name: "Port-au-Prince",
  country: "HT",
  city: "Port-au-Prince",
  center_lat: 18.5944,
  center_lng: -72.3074,
  radius_km: 20,
  base_fee: 250,
  fee_per_km: 150,
  currency: "HTG",
  active: true,
};

describe("calculateFee", () => {
  describe("plancher (minimum = base_fee)", () => {
    it("retourne base_fee pour une distance de 0 km", () => {
      expect(calculateFee(0, santoDomingo)).toBe(50);
      expect(calculateFee(0, portAuPrince)).toBe(250);
    });

    it("ne descend jamais sous base_fee même pour de très courtes distances", () => {
      // 0.1 km * 30 = 3, base 50 → plancher 50
      expect(calculateFee(0.1, santoDomingo)).toBe(50);
      expect(calculateFee(0.5, santoDomingo)).toBe(50);
    });

    it("respecte le plancher pour Port-au-Prince (HTG)", () => {
      // 1 km * 150 = 150, base 250 → plancher 250
      expect(calculateFee(1, portAuPrince)).toBe(250);
    });
  });

  describe("formule base_fee + distance × fee_per_km", () => {
    it("calcule correctement pour Santo Domingo (50 + km × 30)", () => {
      // 5 km : 50 + 5*30 = 200
      expect(calculateFee(5, santoDomingo)).toBe(200);
      // 10 km : 50 + 10*30 = 350
      expect(calculateFee(10, santoDomingo)).toBe(350);
    });

    it("calcule correctement pour Santiago (mêmes tarifs, rayon différent)", () => {
      // 8 km : 50 + 8*30 = 290
      expect(calculateFee(8, santiago)).toBe(290);
    });

    it("calcule correctement pour Port-au-Prince (250 + km × 150)", () => {
      // 3 km : 250 + 3*150 = 700
      expect(calculateFee(3, portAuPrince)).toBe(700);
      // 10 km : 250 + 10*150 = 1750
      expect(calculateFee(10, portAuPrince)).toBe(1750);
    });
  });

  describe("arrondi entier", () => {
    it("arrondit à l'entier le plus proche (arrondi mathématique)", () => {
      // 2.5 km * 30 = 75 ; +50 = 125 → 125
      expect(calculateFee(2.5, santoDomingo)).toBe(125);
      // 1.234 km * 30 = 37.02 ; +50 = 87.02 → 87
      expect(calculateFee(1.234, santoDomingo)).toBe(87);
      // 1.235 km * 30 = 37.05 ; +50 = 87.05 → 87
      expect(calculateFee(1.235, santoDomingo)).toBe(87);
      // 1.25 km * 30 = 37.5 ; +50 = 87.5 → 88 (arrondi sup)
      expect(calculateFee(1.25, santoDomingo)).toBe(88);
    });

    it("retourne toujours un entier", () => {
      const values = [0, 0.7, 1.333, 2.5, 7.89, 15.42];
      for (const v of values) {
        expect(Number.isInteger(calculateFee(v, santoDomingo))).toBe(true);
        expect(Number.isInteger(calculateFee(v, portAuPrince))).toBe(true);
      }
    });

    it("arrondit correctement pour Port-au-Prince", () => {
      // 2.333 km * 150 = 349.95 ; +250 = 599.95 → 600
      expect(calculateFee(2.333, portAuPrince)).toBe(600);
    });
  });

  describe("robustesse", () => {
    it("gère les valeurs string venant de la base (numeric)", () => {
      const zoneAsString = {
        ...santoDomingo,
        base_fee: "50" as unknown as number,
        fee_per_km: "30" as unknown as number,
      };
      // 4 km : 50 + 4*30 = 170
      expect(calculateFee(4, zoneAsString)).toBe(170);
    });
  });
});
