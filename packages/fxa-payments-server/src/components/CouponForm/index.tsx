import './index.scss';

import { Localized } from '@fluent/react';
import React, { FormEventHandler, MouseEventHandler, useState } from 'react';

import { APIError, apiInvoicePreview } from '../../lib/apiClient';
import { Coupon } from '../../lib/Coupon';
import sentry from '../../lib/sentry';

/*
 * Check if the coupon promotion code provided by the user is valid.
 * If it is valid, return the discounted amount in cents.
 */
const checkPromotionCode = async (planId: string, promotionCode: string) => {
  try {
    const { discount } = await apiInvoicePreview({
      priceId: planId,
      promotionCode,
    });

    if (!discount) {
      throw new Error('No discount for coupon');
    }
    return discount.amount;
  } catch (err) {
    if (err instanceof APIError) {
      sentry.captureException(err);
    }
    throw err;
  }
};

type CouponFormProps = {
  planId: string;
  coupon?: Coupon;
  setCoupon: (coupon: Coupon | undefined) => void;
};

export const CouponForm = ({ planId, coupon, setCoupon }: CouponFormProps) => {
  const [hasCoupon, setHasCoupon] = useState(coupon ? true : false);
  const [couponCode, setCouponCode] = useState(coupon ? coupon.couponCode : '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit: FormEventHandler = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      setLoading(true);
      const amount = await checkPromotionCode(planId, couponCode);
      setHasCoupon(true);
      setCoupon({
        couponCode: couponCode,
        amount,
      });
    } catch (err) {
      setCoupon(undefined);
      if (err instanceof APIError) {
        setError('An error occurred processing the coupon. Please try again.');
      } else {
        setError('The code you entered is invalid or expired.');
      }
    } finally {
      setLoading(false);
    }
  };

  const removeCoupon: MouseEventHandler<HTMLButtonElement> = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setHasCoupon(false);
    setCoupon(undefined);
  };

  return (
    <section
      className={`coupon-component ${coupon ? 'has-coupon' : ''}`}
      data-testid="coupon-component"
    >
      <div className="coupon-component-inner">
        {hasCoupon ? (
          <div className="coupon-header">
            <h4>
              <Localized id="coupon-discount-applied">
                Discount Reward Applied
              </Localized>
            </h4>
          </div>
        ) : (
          <div className="coupon-header">
            <h4>
              <Localized id="coupon-discount">Discount</Localized>
            </h4>
          </div>
        )}
        {hasCoupon ? (
          <div className="flex" data-testid="coupon-hascoupon">
            <div className="coupon-details">
              <div>{couponCode}</div>
            </div>
            <button onClick={removeCoupon}>
              <Localized id="coupon-remove">
                <span>Remove</span>
              </Localized>
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} data-testid="coupon-form">
            <div className="input-row">
              <Localized attrs={{ placeholder: true }} id="coupon-enter-code">
                <input
                  className={`${error ? 'invalid' : ''}`}
                  type="text"
                  name="coupon"
                  data-testid="coupon-input"
                  value={couponCode}
                  onChange={(event) => {
                    setError('');
                    setCouponCode(event.target.value);
                  }}
                  placeholder="Enter code"
                  disabled={loading}
                />
              </Localized>
            </div>

            <button
              name="apply"
              type="submit"
              data-testid="coupon-button"
              disabled={loading}
            >
              <Localized id="coupon-submit">
                <span>Apply</span>
              </Localized>
            </button>
          </form>
        )}
        {error ? (
          <Localized id="coupon-error">
            <div className="coupon-error" data-testid="coupon-error">
              {error}
            </div>
          </Localized>
        ) : null}
      </div>
    </section>
  );
};

export default CouponForm;
