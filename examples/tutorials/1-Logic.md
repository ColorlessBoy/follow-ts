# 1. Logic

## 1.1 Imply and Forall

```
type wff number function
prop number run(function f0, number n0)
prop number add(number n0, number n1)
prop wff le(number n0, number n1)
prop wff fnub(function f0, number n0)
prop wff fnlb(function f0, number n0)

axiom df-fnub(function f0, number n0) {
    |- wb fnub(f)
}
```
